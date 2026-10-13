const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { constants } = require('node:fs');
const { spawn } = require('node:child_process');

const project = path.resolve(__dirname, '..');
const version = process.argv[2];
const overwrite = process.argv.includes('--overwrite');
const sourceFiles = [
  'README.md', 'server.js', 'hot100-50-day-plan.md', 'start.cmd', 'build-launchers.cmd', 'launcher/Launcher.cs',
  'public/index.html', 'public/app.css', 'public/app.js', 'public/knowledge.html', 'public/knowledge.css',
  'public/knowledge.js', 'public/knowledge-data.js', 'public/favicon.svg',
  'assets/screenshots/tracker.png', 'assets/screenshots/knowledge-library.png', 'assets/screenshots/related-knowledge.png',
];
const packageFiles = [...sourceFiles, 'start.exe', 'stop.exe', 'release-info.json'].sort();
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const exists = (file) => fs.access(file).then(() => true, () => false);
const psQuote = (value) => "'" + value.replace(/'/g, "''") + "'";

function run(file, args, cwd = project) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { cwd, windowsHide: true, timeout: 30000 });
    let output = '', errors = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { errors += chunk; });
    child.once('error', reject);
    // The background Node process can retain a launcher's inherited pipe handles.
    const finished = ['start.exe', 'stop.exe'].includes(path.basename(file)) ? 'exit' : 'close';
    child.once(finished, (code) => code === 0 ? resolve(output.trim())
      : reject(new Error(path.basename(file) + ' failed (' + code + '): ' + errors + output)));
  });
}

async function filesIn(root, prefix = '') {
  const files = [];
  for (const item of await fs.readdir(path.join(root, prefix), { withFileTypes: true })) {
    const relative = prefix ? prefix + '/' + item.name : item.name;
    assert(!item.isSymbolicLink(), 'Unexpected symbolic link: ' + relative);
    if (item.isDirectory()) files.push(...await filesIn(root, relative));
    else { assert(item.isFile()); files.push(relative); }
  }
  return files.sort();
}

async function verifyPackage(root) {
  assert.deepEqual(await filesIn(root), packageFiles, 'Archive contains missing or unexpected files');
  assert.equal(await exists(path.join(root, 'data')), false, 'Archive contains learning data');
  const catalog = require(path.join(root, 'public', 'knowledge-data.js'));
  assert.equal(catalog.categories.length, 3);
  assert.equal(catalog.topics.length, 41);
  for (const executable of ['start.exe', 'stop.exe']) {
    const bytes = await fs.readFile(path.join(root, executable));
    const pe = bytes.readUInt32LE(0x3c);
    assert.equal(bytes.readUInt16LE(pe + 24 + 68), 2, executable + ' has a console subsystem');
  }
  let running = false;
  const launch = async () => {
    const report = JSON.parse(await run(path.join(root, 'start.exe'), ['--quiet', '--no-open', '--diagnostics'], root));
    running = true;
    assert.equal(report.consoleWindow, 0);
    assert.equal(report.reused, false);
    return 'http://127.0.0.1:' + report.port;
  };
  const stop = async () => {
    if (!running) return;
    await run(path.join(root, 'stop.exe'), ['--quiet', '--diagnostics'], root);
    running = false;
  };
  try {
    let origin = await launch();
    assert.deepEqual(await (await fetch(origin + '/api/progress')).json(), { version: 1, items: {} });
    const plan = await (await fetch(origin + '/api/plan')).json();
    const days = plan.stages.flatMap((stage) => stage.days);
    assert.equal(plan.stages.length, 8);
    assert.equal(days.length, 50);
    assert(days.every((day, index) => day.number === index + 1 && day.questions.length === 2));
    const ids = days.flatMap((day) => day.questions.map((question) => question.id));
    assert.equal(new Set(ids).size, 100);
    assert(ids.every((id) => catalog.topics.some((topic) => topic.problems.includes(id))));
    for (const route of ['/', '/knowledge', '/app.js', '/app.css', '/knowledge.js', '/knowledge.css', '/knowledge-data.js', '/favicon.svg']) {
      const response = await fetch(origin + route);
      assert.equal(response.status, 200, 'Missing runtime asset: ' + route);
      const body = await response.text();
      if (route === '/' || route === '/knowledge') assert(body.includes('href="/favicon.svg"'));
    }
    const headers = { 'Content-Type': 'application/json', 'X-Hot100-Request': '1', Origin: origin };
    assert.equal((await fetch(origin + '/api/progress', { method: 'PUT', headers,
      body: JSON.stringify({ version: 1, items: { 1: { done: 'invalid', mastery: null, note: '' } } }) })).status, 400);
    const fixture = { version: 1, items: { 1: { done: true, mastery: 'B', note: 'Release verification fixture' } } };
    assert.equal((await fetch(origin + '/api/progress', { method: 'PUT', headers, body: JSON.stringify(fixture) })).status, 200);
    assert.deepEqual(await (await fetch(origin + '/api/progress')).json(), fixture);
    await stop();
    origin = await launch();
    assert.deepEqual(await (await fetch(origin + '/api/progress')).json(), fixture);
    await stop();
  } finally { await stop(); }
  // The fixture is written only to this discarded extraction, after ZIP creation.
  return { files: packageFiles.length, defaultProgress: 'empty', stages: 8, days: 50, problems: 100,
    topics: 41, launchers: 'GUI', runtimeAssets: 'passed', saveAndRestart: 'passed', nodeBundled: false };
}

async function main() {
  assert.equal(process.platform, 'win32', 'Build this Windows package on Windows');
  assert(typeof version === 'string' && /^v\d+(?:\.\d+){0,2}(?:-[\da-z.-]+)?$/i.test(version)
    && version.length <= 40, 'Usage: node scripts/package-release.cjs v0.2.0 [--overwrite]');
  assert(process.argv.slice(3).every((arg) => arg === '--overwrite'), 'Unknown option');
  const packageName = 'hot100-tracker-' + version + '-windows';
  const output = path.join(project, 'dist');
  const zipPath = path.join(output, packageName + '.zip');
  assert(overwrite || !await exists(zipPath), 'Package already exists. Use --overwrite to rebuild this version.');
  const commit = await run('git', ['rev-parse', 'HEAD']);
  await run('git', ['diff', '--exit-code', 'HEAD', '--', ...sourceFiles]);
  const systemRoot = process.env.SystemRoot || 'C:/Windows';
  const powershell = path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const compilers = ['Framework64', 'Framework'].map((folder) => path.join(systemRoot, 'Microsoft.NET', folder, 'v4.0.30319', 'csc.exe'));
  let compiler;
  for (const candidate of compilers) if (await exists(candidate)) { compiler = candidate; break; }
  assert(compiler, 'Windows .NET Framework C# compiler is unavailable');
  await fs.access(powershell);
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'hot100-release-'));
  try {
    const stage = path.join(temporary, packageName);
    await fs.mkdir(stage);
    for (const relative of sourceFiles) {
      const target = path.join(stage, relative);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.copyFile(path.join(project, relative), target);
    }
    // Sanitize only the staged plan; the source and personal progress stay untouched.
    const planFile = path.join(stage, 'hot100-50-day-plan.md');
    let plan = await fs.readFile(planFile, 'utf8');
    plan = plan.replace(/^> .*当前进度.*$/m, '> 🧭 **当前进度：Day 01 / 50**　·　每天两题　·　先理解，再独立重写')
      .replace(/^复盘：[^\r\n]*$/gm, '复盘：`待填写`　掌握：`— / —`');
    await fs.writeFile(planFile, plan);
    const readmeFile = path.join(stage, 'README.md');
    let readme = await fs.readFile(readmeFile, 'utf8');
    readme = readme.replace(/\r\n/g, '\n').replace(/^## 开发检查\n[\s\S]*$/m, '')
      .replace(/^└── tests\/[^\n]*\n/gm, '').replace(/^├── data\/$/gm, '└── data/')
      .replace(/^│   └── progress\.json/gm, '    └── progress.json')
      .replace('`start.exe` 和 `stop.exe` 需要在本地生成', '`start.exe` 和 `stop.exe` 已随发布包提供')
      .replace(/1\. 首次下载后，如果没有[^\n]*\n/, '1. Release 压缩包已包含启动器，无需自行编译；先安装 Node.js。\n');
    readme = readme.replace(/^(# [^\n]+\n)/, '$1\n> ' + version + ' Windows 轻量完整版：包含完整功能和预编译启动器；不附带 Node.js，需要先安装 Node.js。首次使用从零进度开始。\n');
    await fs.writeFile(readmeFile, readme.trimEnd() + '\n');
    for (const executable of ['start.exe', 'stop.exe']) {
      await run(compiler, ['/nologo', '/target:winexe', '/platform:anycpu', '/optimize+', '/reference:System.Windows.Forms.dll',
        ...(executable === 'stop.exe' ? ['/define:STOP_ENTRY'] : []), '/out:' + path.join(stage, executable), path.join(stage, 'launcher', 'Launcher.cs')]);
    }
    const manifest = { version, sourceCommit: commit, platform: 'Windows', nodeBundled: false, createdAt: new Date().toISOString(), files: {} };
    for (const file of packageFiles.filter((file) => file !== 'release-info.json')) {
      manifest.files[file] = hash(await fs.readFile(path.join(stage, file)));
    }
    await fs.writeFile(path.join(stage, 'release-info.json'), JSON.stringify(manifest, null, 2) + '\n');
    assert.deepEqual(await filesIn(stage), packageFiles);
    const stagedZip = path.join(temporary, packageName + '.zip');
    const expanded = path.join(temporary, 'extracted');
    const command = '$ErrorActionPreference = "Stop"; Compress-Archive -LiteralPath ' + psQuote(stage)
      + ' -DestinationPath ' + psQuote(stagedZip) + '; Expand-Archive -LiteralPath ' + psQuote(stagedZip) + ' -DestinationPath ' + psQuote(expanded);
    await run(powershell, ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(command, 'utf16le').toString('base64')]);
    const extractedRoot = path.join(expanded, packageName);
    for (const [file, digest] of Object.entries(manifest.files)) {
      assert.equal(hash(await fs.readFile(path.join(extractedRoot, file))), digest, 'Archive changed a file: ' + file);
    }
    const verification = await verifyPackage(extractedRoot);
    await fs.mkdir(output, { recursive: true });
    await fs.copyFile(stagedZip, zipPath, overwrite ? 0 : constants.COPYFILE_EXCL);
    const checksum = hash(await fs.readFile(zipPath));
    await fs.writeFile(path.join(output, packageName + '.sha256.txt'), checksum + '  ' + packageName + '.zip\n');
    await fs.writeFile(path.join(output, packageName + '.verification.json'), JSON.stringify({ version, sourceCommit: commit, sha256: checksum, ...verification }, null, 2) + '\n');
    const notes = '# ' + version + ' · 界面、知识库体验与启动更新\n\n'
      + '## 下载与启动\n\n- 请下载附件 `' + packageName + '.zip`，完整解压后使用。\n'
      + '- 这是 Windows 轻量完整版，包含完整功能和预编译启动器，不附带 Node.js；需要先安装 Node.js。\n'
      + '- 双击 `start.exe` 无窗口启动；关闭网页后可再次双击进入，双击 `stop.exe` 停止后台服务。\n'
      + '- GitHub 自动生成的 Source code 附件是源码快照；日常使用请下载上述 ZIP。\n\n'
      + '## 本次更新\n\n- 优化 Java API、基础算法与数据结构、解题思想知识库，以及相关知识弹窗的阅读体验。\n'
      + '- 调整页面配色、目录层级、统一搜索和代码块显示。\n'
      + '- 完整知识库在当前标签页打开，后退恢复相关知识弹窗和阅读位置。\n'
      + '- 提供无命令窗口的 Windows 启动与停止入口，以及统一的 H. 标签页图标。\n'
      + '- 更新中文介绍与界面截图。\n\n'
      + '## 数据说明\n\n- 发布 ZIP 不含作者的学习进度、笔记、日志、开发 skills 和内部项目文档。\n'
      + '- 新用户从零进度开始，首次保存后生成自己的 `data/progress.json`。\n'
      + '- 更新已有版本时，先备份自己的 `data/progress.json`，解压新版后再恢复该文件。\n';
    await fs.writeFile(path.join(output, 'release-notes-' + version + '.md'), notes);
    console.log(JSON.stringify({ package: path.relative(project, zipPath), sourceCommit: commit, sha256: checksum, ...verification }, null, 2));
  } finally {
    const resolved = path.resolve(temporary);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert(path.basename(resolved).startsWith('hot100-release-'));
    await fs.rm(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
