const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');

const appDir = __dirname;
const publicDir = path.join(appDir, 'public');
const dataDir = path.join(appDir, 'data');
const planPath = path.join(appDir, 'hot100-50-day-plan.md');
const progressPath = path.join(dataDir, 'progress.json');
const host = '127.0.0.1';
const maxBodyBytes = 65536;
let saveQueue = Promise.resolve();

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
  const port = server.address().port;
  const origin = `http://${host}:${port}`;
  if (request.headers.host !== `${host}:${port}`) {
    sendJson(response, 403, { error: 'Invalid host' });
    return;
  }

  try {
    const pathname = new URL(request.url, origin).pathname;
    if (request.method === 'GET' && pathname === '/') {
      send(response, 200, await fs.readFile(path.join(publicDir, 'index.html'), 'utf8'), 'text/html; charset=utf-8');
    } else if (request.method === 'GET' && pathname === '/app.css') {
      send(response, 200, await fs.readFile(path.join(publicDir, 'app.css'), 'utf8'), 'text/css; charset=utf-8');
    } else if (request.method === 'GET' && pathname === '/app.js') {
      send(response, 200, await fs.readFile(path.join(publicDir, 'app.js'), 'utf8'), 'text/javascript; charset=utf-8');
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
    console.error('Request failed:', error.message);
    sendJson(response, status, { error: status === 500 ? 'Could not read or save the local files' : error.message });
  }
});

server.listen(0, host, () => {
  const url = `http://${host}:${server.address().port}/`;
  console.log(`Hot 100 tracker: ${url}`);
  console.log(`Progress file: ${progressPath}`);
  if (!process.argv.includes('--no-open') && process.platform === 'win32') {
    const launcher = spawn('cmd.exe', ['/c', 'start', '', url], { windowsHide: true, detached: true, stdio: 'ignore' });
    launcher.unref();
  }
});
