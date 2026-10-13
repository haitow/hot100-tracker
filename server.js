const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID, createHash } = require('node:crypto');
const net = require('node:net');
const fsSync = require('node:fs');

const appDir = __dirname;
const publicDir = path.join(appDir, 'public');
const dataDir = path.join(appDir, 'data');
const planPath = path.join(appDir, 'hot100-50-day-plan.md');
const progressPath = path.join(dataDir, 'progress.json');
const host = '127.0.0.1';
const maxBodyBytes = 65536;
let saveQueue = Promise.resolve();
const runtimeId = randomUUID();
const background = process.argv.includes('--background');
let logQueue = Promise.resolve();
let stopping = false;
let servicePort = 0;

function serviceLog(message, error = false) {
  if (!background) {
    (error ? console.error : console.log)(message);
    return;
  }
  const directory = path.join(appDir, '.runtime');
  logQueue = logQueue.catch(() => {}).then(async () => {
    await fs.mkdir(directory, { recursive: true });
    await fs.appendFile(path.join(directory, 'server.log'), `${new Date().toISOString()} ${message}\n`);
  }).catch(() => {});
}

function openBrowser(url) {
  if (!process.argv.includes('--no-open') && process.platform === 'win32') {
    const launcher = spawn('cmd.exe', ['/c', 'start', '', url], { windowsHide: true, detached: true, stdio: 'ignore' });
    launcher.on('error', () => serviceLog('Could not open the browser.', true));
    launcher.unref();
  }
}
const staticFiles = new Map([
  ['/', ['index.html', 'text/html']],
  ['/knowledge', ['knowledge.html', 'text/html']],
  ['/app.css', ['app.css', 'text/css']],
  ['/app.js', ['app.js', 'text/javascript']],
  ['/knowledge.css', ['knowledge.css', 'text/css']],
  ['/knowledge.js', ['knowledge.js', 'text/javascript']],
  ['/knowledge-data.js', ['knowledge-data.js', 'text/javascript']],
]);

function send(response, status, body, contentType = 'application/json; charset=utf-8') {
  const bytes = Buffer.from(body, 'utf8');
  response.writeHead(status, {
    'Content-Type': contentType,
    'Content-Length': bytes.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'",
  });
  response.end(bytes);
}

function sendJson(response, status, data) {
  send(response, status, JSON.stringify(data));
}

async function readPlan() {
  const markdown = await fs.readFile(planPath, 'utf8');
  const stagePattern = /^## (\d{2}) · (.+?)（Day [^\r\n]+）$/gm;
  const stageMatches = [...markdown.matchAll(stagePattern)];
  const stages = stageMatches.map((stage, index) => {
    const section = markdown.slice(stage.index + stage[0].length, stageMatches[index + 1]?.index ?? markdown.length);
    const dayMatches = [...section.matchAll(/^### Day (\d{2}) · (.+)$/gm)];
    const days = dayMatches.map((day, dayIndex) => {
      const content = section.slice(day.index + day[0].length, dayMatches[dayIndex + 1]?.index ?? section.length);
      const questions = [...content.matchAll(/^- \[ \] (🟢|🔵|🔴) \[(\d+)\. ([^\]]+)\]\((https:\/\/leetcode\.cn\/problems\/[^)]+\/)\)$/gm)]
        .map((match) => ({
          id: Number(match[2]),
          title: match[3],
          url: match[4],
          difficulty: { '🟢': 'easy', '🔵': 'medium', '🔴': 'hard' }[match[1]],
        }));
      return { number: Number(day[1]), title: day[2], questions };
    });
    return { number: Number(stage[1]), title: stage[2], days };
  });

  const days = stages.flatMap((stage) => stage.days);
  const ids = days.flatMap((day) => day.questions.map((question) => question.id));
  if (stages.length !== 8 || days.length !== 50 || ids.length !== 100 || new Set(ids).size !== 100
      || days.some((day, index) => day.number !== index + 1 || day.questions.length !== 2)) {
    throw new Error('The Markdown plan must contain eight stages, 50 ordered days, and 100 unique problems.');
  }
  return stages;
}

async function readProgress() {
  try {
    const data = JSON.parse(await fs.readFile(progressPath, 'utf8'));
    if (!data || data.version !== 1 || typeof data.items !== 'object' || Array.isArray(data.items)) {
      throw new Error('Invalid progress format');
    }
    return data;
  } catch (error) {
    if (error.code === 'ENOENT') return { version: 1, items: {} };
    throw error;
  }
}

function validateProgress(value, knownIds) {
  if (!value || value.version !== 1 || !value.items || typeof value.items !== 'object'
      || Array.isArray(value.items) || Object.keys(value.items).length > 100) return false;
  return Object.entries(value.items).every(([id, item]) =>
    knownIds.has(Number(id)) && /^\d+$/.test(id) && item && typeof item === 'object'
    && !Array.isArray(item) && typeof item.done === 'boolean'
    && (item.mastery === null || ['A', 'B', 'C'].includes(item.mastery))
    && typeof item.note === 'string' && item.note.length <= 200
    && Object.keys(item).every((key) => ['done', 'mastery', 'note'].includes(key)));
}

async function readBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBodyBytes) {
      const error = new Error('Request too large');
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function writeProgress(data) {
  const temporaryPath = `${progressPath}.${process.pid}.tmp`;
  try {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(temporaryPath, `${JSON.stringify(data, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    await fs.rename(temporaryPath, progressPath);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true }).catch(() => {});
    throw error;
  }
}

const server = http.createServer(async (request, response) => {
  const port = servicePort;
  const origin = `http://${host}:${port}`;
  if (request.headers.host !== `${host}:${port}`) {
    sendJson(response, 403, { error: 'Invalid host' });
    return;
  }

  try {
    const pathname = new URL(request.url, origin).pathname;
    if (request.method === 'GET' && staticFiles.has(pathname)) {
      const [filename, contentType] = staticFiles.get(pathname);
      send(response, 200, await fs.readFile(path.join(publicDir, filename), 'utf8'), `${contentType}; charset=utf-8`);
    } else if (request.method === 'GET' && pathname === '/api/session') {
      sendJson(response, 200, { id: runtimeId });
    } else if (request.method === 'GET' && pathname === '/api/plan') {
      sendJson(response, 200, { stages: await readPlan() });
    } else if (request.method === 'GET' && pathname === '/api/progress') {
      sendJson(response, 200, await readProgress());
    } else if (request.method === 'PUT' && pathname === '/api/progress') {
      if (request.headers.origin !== origin || request.headers['x-hot100-request'] !== '1'
          || !request.headers['content-type']?.startsWith('application/json')) {
        sendJson(response, 403, { error: 'Request denied' });
        return;
      }
      const data = JSON.parse(await readBody(request));
      const knownIds = new Set((await readPlan()).flatMap((stage) =>
        stage.days.flatMap((day) => day.questions.map((question) => question.id))));
      if (!validateProgress(data, knownIds)) {
        sendJson(response, 400, { error: 'Invalid progress data' });
        return;
      }
      saveQueue = saveQueue.catch(() => {}).then(() => writeProgress(data));
      await saveQueue;
      sendJson(response, 200, { saved: true });
    } else {
      sendJson(response, 404, { error: 'Not found' });
    }
  } catch (error) {
    const status = error.status ?? (error instanceof SyntaxError ? 400 : 500);
    serviceLog(`Request failed (${status}).`, true);
    sendJson(response, status, { error: status === 500 ? 'Could not read or save the local files' : error.message });
  }
});

const connections = new Map();
server.on('connection', (socket) => {
  connections.set(socket, 0);
  socket.on('close', () => connections.delete(socket));
});
server.prependListener('request', (request, response) => {
  const socket = request.socket;
  connections.set(socket, (connections.get(socket) ?? 0) + 1);
  let completed = false;
  const finish = () => {
    if (completed) return;
    completed = true;
    const pending = Math.max(0, (connections.get(socket) ?? 1) - 1);
    if (connections.has(socket)) connections.set(socket, pending);
    if (stopping && pending === 0) socket.end();
  };
  response.once('finish', finish);
  response.once('close', finish);
});

function listen() {
  server.listen(0, host, () => {
    servicePort = server.address().port;
    const url = `http://${host}:${servicePort}/`;
    serviceLog(`Hot 100 tracker: ${url}`);
    if (!background) serviceLog(`Progress file: ${progressPath}`);
    openBrowser(url);
  });
}

// A per-project Windows pipe coordinates launchers without exposing a stop HTTP API.
if (process.platform !== 'win32') {
  listen();
} else {
  const canonical = fsSync.realpathSync.native(appDir).replace(/\\/g, '/').toLowerCase();
  const key = createHash('sha256').update(canonical).digest('hex').slice(0, 32);
  const pipePath = `\\\\.\\pipe\\hot100-${key}`;
  const control = net.createServer((socket) => {
    let input = '';
    socket.setEncoding('utf8');
    socket.setTimeout(1500, () => socket.destroy());
    socket.on('error', () => {});
    socket.on('data', (chunk) => {
      input += chunk;
      if (input.length > 128) { socket.destroy(); return; }
      if (!input.includes('\n')) return;
      const command = input.trim();
      input = '';
      if (command === 'STATUS') {
        const state = stopping ? 'STOPPING' : servicePort ? 'READY' : 'STARTING';
        socket.end(`HOT100\t${state}\t${process.pid}\t${servicePort}\t${runtimeId}\n`);
      } else if (command === `STOP ${runtimeId}` && !stopping && servicePort) {
        stopping = true;
        socket.setTimeout(0);
        (async () => {
          if (server.listening) await new Promise((resolve) => {
            server.close(resolve);
            // Browsers can leave speculative sockets open without sending a request.
            for (const [connection, pending] of connections) {
              if (pending === 0) connection.destroy();
            }
          });
          await saveQueue.catch(() => {});
          serviceLog('Service stopped.');
          await logQueue.catch(() => {});
          socket.end('STOPPED\n');
          control.close();
        })().catch(() => { socket.end('ERROR\n'); control.close(); });
      } else {
        socket.end('ERROR\n');
      }
    });
  });
  control.on('error', (error) => {
    if (error.code !== 'EADDRINUSE') {
      serviceLog('Could not create the local service control pipe.', true);
      process.exitCode = 1;
      return;
    }
    const existing = net.connect(pipePath);
    let reply = '';
    existing.setEncoding('utf8');
    existing.setTimeout(1500, () => existing.destroy(new Error('Service lookup timed out')));
    existing.on('connect', () => existing.write('STATUS\n'));
    existing.on('data', (chunk) => {
      reply += chunk;
      if (reply.length > 256) existing.destroy(new Error('Invalid service response'));
    });
    existing.on('end', () => {
      const fields = reply.trim().split('\t');
      const port = Number(fields[3]);
      if (fields[0] !== 'HOT100' || fields[1] !== 'READY' || !Number.isInteger(port) || port < 1 || port > 65535) {
        serviceLog('An existing service is still starting or stopping. Retry shortly.', true);
        process.exitCode = 1;
        return;
      }
      const url = `http://${host}:${port}/`;
      serviceLog(`Hot 100 tracker: ${url}`);
      openBrowser(url);
    });
    existing.on('error', () => {
      serviceLog('Could not connect to the existing project service.', true);
      process.exitCode = 1;
    });
  });
  server.on('error', () => {
    serviceLog('Could not start the local HTTP service.', true);
    process.exitCode = 1;
    control.close();
  });
  control.listen(pipePath, listen);
}
