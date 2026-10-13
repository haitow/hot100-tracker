const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const http = require('node:http');
const { createHash } = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');

if (process.platform !== 'win32') throw new Error('Launcher checks require Windows.');
const project = path.resolve(__dirname, '..');
const compiler = process.argv.slice(2).find((arg) => !arg.startsWith('--')) ?? 'C:/Windows/Microsoft.NET/Framework64/v4.0.30319/csc.exe';
const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
async function waitFor(check, description) {
  const start = performance.now();
  while (!await check()) {
    assert(performance.now() - start < 10000, 'Timed out: ' + description);
    await pause(15);
  }
}
function pipeFor(root) {
  const canonical = require('node:fs').realpathSync.native(root).replace(/\\/g, '/').toLowerCase();
  return '\\\\.\\pipe\\hot100-' + createHash('sha256').update(canonical).digest('hex').slice(0, 32);
}
function control(root, command) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(pipeFor(root));
    let reply = '';
    socket.setEncoding('utf8');
    socket.setTimeout(10000, () => socket.destroy(new Error('Control request timed out')));
    socket.on('connect', () => socket.write(command + '\n'));
    socket.on('data', (chunk) => { reply += chunk; });
    socket.on('end', () => resolve(reply.trim()));
    socket.on('error', reject);
  });
}
function run(root, executable = 'start.exe', options = {}) {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const child = spawn(path.join(root, executable), [...(options.openBrowser ? [] : ['--no-open']), '--quiet', '--diagnostics'], {
      cwd: options.cwd ?? root, windowsHide: false, env: options.env ?? process.env,
      stdio: options.openBrowser ? 'ignore' : 'pipe',
    });
    let output = '', error = '';
    child.stdout?.on('data', (chunk) => { output += chunk; });
    child.stderr?.on('data', (chunk) => { error += chunk; });
    child.on('error', reject);
    child.on('exit', (code) => {
      try { resolve({ code, report: options.openBrowser ? null : JSON.parse(output.trim()), wallMs: Math.round(performance.now() - start), error }); }
      catch (failure) { reject(new Error('Invalid launcher diagnostics: ' + output + ' ' + error, { cause: failure })); }
    });
  });
}
async function clone(root, fixture) {
  await fs.mkdir(path.join(root, 'public'), { recursive: true });
  await fs.mkdir(path.join(root, 'data'));
  for (const file of ['server.js', 'hot100-50-day-plan.md', 'start.exe', 'stop.exe'])
    await fs.copyFile(path.join(project, file), path.join(root, file));
  for (const file of await fs.readdir(path.join(project, 'public')))
    await fs.copyFile(path.join(project, 'public', file), path.join(root, 'public', file));
  await fs.writeFile(path.join(root, 'data', 'progress.json'), fixture);
}
async function main() {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'hot100-launcher-'));
  const root = path.join(temporary, '中文 path & spaces');
  const other = path.join(temporary, 'other-project');
  const fixture = JSON.stringify({ version: 1, items: { 1: { done: true, mastery: 'B', note: 'Isolated saved progress' } } }, null, 2);
  let observer;
  const observerStop = path.join(temporary, 'observer.stop');
  const observerReady = path.join(temporary, 'observer.ready');
  const eventsFile = path.join(temporary, 'window-events.txt');
  try {
    await clone(root, fixture); await clone(other, fixture);
    for (const executable of ['start.exe', 'stop.exe']) {
      const bytes = await fs.readFile(path.join(root, executable));
      const pe = bytes.readUInt32LE(0x3c);
      assert.equal(bytes.readUInt16LE(pe + 24 + 68), 2, executable + ' is not a Windows GUI executable');
    }
    const compiled = spawnSync(compiler, ['/nologo', '/target:winexe', '/reference:System.Windows.Forms.dll',
      '/out:' + path.join(temporary, 'observer.exe'), path.join(project, 'tests', 'observe-launcher-windows.cs')], { windowsHide: true, encoding: 'utf8' });
    assert.equal(compiled.status, 0, compiled.stdout + compiled.stderr);
    observer = spawn(path.join(temporary, 'observer.exe'), [observerStop, eventsFile, observerReady], { windowsHide: false, stdio: 'ignore' });
    await waitFor(async () => fs.access(observerReady).then(() => true, () => false), 'window observer');
    const cold = await run(root, 'start.exe', { cwd: temporary });
    assert.equal(cold.code, 0, JSON.stringify(cold));
    assert.equal(cold.report.consoleWindow, 0);
    assert.equal(cold.report.reused, false);
    const origin = 'http://127.0.0.1:' + cold.report.port;
    assert.equal((await fetch(origin + '/')).status, 200);
    assert.equal((await (await fetch(origin + '/api/session')).json()).id, cold.report.id);
    assert.equal((await (await fetch(origin + '/api/plan')).json()).stages.length, 8);
    const warm = [];
    for (let i = 0; i < 4; i++) {
      const result = await run(root);
      assert.equal(result.code, 0);
      assert.equal(result.report.pid, cold.report.pid);
      assert.equal(result.report.id, cold.report.id);
      assert.equal(result.report.reused, true);
      warm.push(result.wallMs);
    }
    const reuseWithoutNodePath = await run(root, 'start.exe', { env: { ...process.env, PATH: '' } });
    assert.equal(reuseWithoutNodePath.report.pid, cold.report.pid);
    const concurrent = await Promise.all(Array.from({ length: 4 }, () => run(root)));
    assert(concurrent.every((result) => result.code === 0 && result.report.pid === cold.report.pid));
    assert.equal(await control(root, 'STOP stale-runtime-id'), 'ERROR');
    assert.equal((await fetch(origin + '/')).status, 200);
    assert.equal(await new Promise((resolve, reject) => http.get(origin + '/', { headers: { Host: 'example.com' } },
      (response) => { response.resume(); resolve(response.statusCode); }).on('error', reject)), 403);
    assert.equal(await fs.readFile(path.join(root, 'data', 'progress.json'), 'utf8'), fixture);
    const foreign = await run(other);
    assert.equal(foreign.code, 0);
    const idle = net.connect(cold.report.port, '127.0.0.1');
    await new Promise((resolve, reject) => { idle.once('connect', resolve); idle.once('error', reject); });
    idle.on('error', () => {});
    const stopped = await run(root, 'stop.exe');
    assert.equal(stopped.code, 0, JSON.stringify(stopped));
    idle.destroy();
    assert.equal((await fetch('http://127.0.0.1:' + foreign.report.port + '/')).status, 200, 'Stopping one project affected another');
    const missingNode = await run(root, 'start.exe', { env: { ...process.env, PATH: '' } });
    assert.equal(missingNode.code, 1);
    assert.equal(missingNode.report.consoleWindow, 0);
    assert((await fs.readFile(path.join(root, '.runtime', 'launcher.log'), 'utf8')).includes('Node.js'));
    const simultaneousCold = await Promise.all(Array.from({ length: 3 }, () => run(root)));
    assert(simultaneousCold.every((result) => result.code === 0));
    assert.equal(new Set(simultaneousCold.map((result) => result.report.pid)).size, 1);
    assert.equal(simultaneousCold.filter((result) => !result.report.reused).length, 1);
    await run(root, 'stop.exe');

    // A preload delays only the isolated fixture's rename to test graceful shutdown.
    const preload = path.join(root, 'delay-save.cjs');
    await fs.writeFile(preload, `const fs = require('node:fs/promises');\nconst path = require('node:path');\nconst rename = fs.rename;\nfs.rename = async (...args) => {\n  if (path.basename(args[1]) === 'progress.json') {\n    await fs.writeFile(path.join(__dirname, 'save.pending'), 'pending');\n    while (await fs.access(path.join(__dirname, 'save.hold')).then(() => true, () => false)) await new Promise(r => setTimeout(r, 15));\n  }\n  return rename(...args);\n};\n`);
    await fs.writeFile(path.join(root, 'save.hold'), 'hold');
    const delayed = await run(root, 'start.exe', { env: { ...process.env, NODE_OPTIONS: '--require=' + JSON.stringify(preload.replace(/\\/g, '/')) } });
    assert.equal(delayed.code, 0);
    const delayedOrigin = 'http://127.0.0.1:' + delayed.report.port;
    const edited = { version: 1, items: { 1: { done: true, mastery: 'A', note: 'Saved before graceful shutdown' } } };
    const saving = fetch(delayedOrigin + '/api/progress', { method: 'PUT', headers: {
      'Content-Type': 'application/json', 'X-Hot100-Request': '1', Origin: delayedOrigin,
    }, body: JSON.stringify(edited) });
    await waitFor(async () => fs.access(path.join(root, 'save.pending')).then(() => true, () => false), 'delayed save');
    let stoppedEarly = false;
    const stopping = run(root, 'stop.exe').then((result) => { stoppedEarly = true; return result; });
    await pause(150);
    assert.equal(stoppedEarly, false, 'Stop did not wait for a pending save');
    await fs.unlink(path.join(root, 'save.hold'));
    assert.equal((await saving).status, 200);
    assert.equal((await stopping).code, 0);
    const restarted = await run(root);
    assert.equal(restarted.code, 0);
    assert.notEqual(restarted.report.id, delayed.report.id);
    assert.deepEqual(await (await fetch('http://127.0.0.1:' + restarted.report.port + '/api/progress')).json(), edited);
    await run(root, 'stop.exe');

    const direct = spawn(process.execPath, ['server.js', '--no-open'], { cwd: root, windowsHide: true });
    let directOutput = '';
    direct.stdout.on('data', (chunk) => { directOutput += chunk; });
    await waitFor(async () => /http:\/\/127\.0\.0\.1:\d+\//.test(directOutput), 'debug startup');
    const debugReuse = await run(root);
    assert.equal(debugReuse.report.pid, direct.pid);
    const duplicate = spawnSync(process.execPath, ['server.js', '--no-open'], { cwd: root, windowsHide: true, timeout: 10000, encoding: 'utf8' });
    assert.equal(duplicate.status, 0, duplicate.stderr + duplicate.stdout);
    assert(duplicate.stdout.includes('http://127.0.0.1:' + debugReuse.report.port));
    await run(root, 'stop.exe');
    await run(other, 'stop.exe');
    const noService = await run(root, 'stop.exe');
    assert.equal(noService.code, 0);
    assert.equal(noService.report.pid, 0);
    let browserPageRequestMs;
    if (process.argv.includes('--open-browser')) {
      const browserProbe = path.join(root, 'browser-probe.cjs');
      const browserRequest = path.join(root, 'browser-request.txt');
      await fs.writeFile(path.join(root, 'public', 'index.html'), '<!doctype html><meta charset="utf-8"><title>Hot 100 启动验证</title><h1>启动验证已通过</h1><p>这是隔离验证页，不涉及学习进度。此标签页可以关闭。</p>');
      await fs.writeFile(browserProbe, `const http = require('node:http');\nconst fs = require('node:fs');\nconst path = require('node:path');\nconst create = http.createServer;\nhttp.createServer = function (...args) {\n  const service = create.apply(this, args);\n  service.prependListener('request', (request) => { if (request.method === 'GET' && request.url === '/') fs.writeFileSync(path.join(__dirname, 'browser-request.txt'), String(Date.now())); });\n  return service;\n};\n`);
      const startedAt = Date.now();
      const opened = await run(root, 'start.exe', { openBrowser: true,
        env: { ...process.env, NODE_OPTIONS: '--require=' + JSON.stringify(browserProbe.replace(/\\/g, '/')) } });
      assert.equal(opened.code, 0, JSON.stringify(opened));
      await waitFor(async () => fs.access(browserRequest).then(() => true, () => false), 'default browser page request');
      browserPageRequestMs = Number(await fs.readFile(browserRequest, 'utf8')) - startedAt;
      const stoppedAfterBrowser = await run(root, 'stop.exe');
      assert.equal(stoppedAfterBrowser.code, 0, 'Browser preconnect prevented shutdown');
    }
    await fs.writeFile(observerStop, 'stop');
    await waitFor(async () => fs.access(eventsFile).then(() => true, () => false), 'window observations');
    assert.equal((await fs.readFile(eventsFile, 'utf8')).trim(), '', 'A console window became visible during launcher checks');
    console.log(JSON.stringify({ coldServiceReadyMs: cold.wallMs, warmOpenPreparationMs: warm,
      browserPageRequestMs,
      consoleWindowEvents: 0, guiSubsystem: 'passed', repeatAndConcurrentStartup: 'passed', projectIsolation: 'passed',
      gracefulSaveAndRestart: 'passed', idleBrowserConnectionShutdown: 'passed', missingNode: 'passed', debugCompatibility: 'passed', realProgressUntouched: true }));
  } finally {
    for (const directory of [root, other]) await run(directory, 'stop.exe').catch(() => {});
    if (observer && observer.exitCode === null) {
      await fs.writeFile(observerStop, 'stop').catch(() => {});
      await waitFor(() => observer.exitCode !== null, 'observer exit').catch(() => observer.kill());
    }
    assert.equal(path.dirname(path.resolve(temporary)), path.resolve(os.tmpdir()));
    assert(path.basename(temporary).startsWith('hot100-launcher-'));
    await fs.rm(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
