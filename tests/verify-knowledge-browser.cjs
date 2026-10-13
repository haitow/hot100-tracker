const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { chromium } = require(process.argv[2] ?? 'playwright');
const catalog = require('../public/knowledge-data.js');

async function main() {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'hot100-browser-'));
  const project = path.resolve(__dirname, '..');
  const screenshotDir = process.argv[4];
  const key = 'hot100.knowledge.reading';
  const fixture = { version: 1, items: { 1: { done: true, mastery: 'B', note: 'Representative saved note <script>' } } };
  const fixtureBytes = JSON.stringify(fixture, null, 2);
  let service, browser;
  const errors = [];
  let writes = 0;
  const start = async (port = 0) => {
    service = spawn(process.execPath, ['--require', './test-port.cjs', 'server.js', '--no-open', '--test-port=' + port], { cwd: temporary, windowsHide: true });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Startup timeout')), 10000);
      service.stdout.on('data', (chunk) => {
        const match = chunk.toString().match(/http:\/\/127\.0\.0\.1:\d+\//);
        if (match) { clearTimeout(timer); resolve(match[0]); }
      });
      service.on('error', (error) => { clearTimeout(timer); reject(error); });
      service.on('exit', (code) => { clearTimeout(timer); reject(new Error('Service exited ' + code)); });
    });
  };
  const stop = async () => {
    if (service && service.exitCode === null) {
      const exited = new Promise((resolve) => service.once('exit', resolve));
      service.kill(); await exited;
    }
  };
  const shot = async (page, name) => {
    if (screenshotDir) await page.screenshot({ path: path.join(screenshotDir, name + '.png') });
  };
  const contextFor = async (viewport = { width: 1440, height: 1000 }) => {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    context.on('page', (page) => {
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error' && /Content Security Policy|Refused to execute|Refused to apply/.test(message.text())) errors.push(message.text());
      });
      page.on('request', (request) => { if (request.method() === 'PUT') writes++; });
    });
    return context;
  };
  const button = (page, name) => page.getByRole('button', { name, exact: true });
  const ready = async (page, runtimeId) => {
    await page.locator('.directory-tree').waitFor({ state: 'attached' });
    await page.locator('#knowledge-reader[aria-busy="false"]').waitFor({ state: 'attached' });
    await page.waitForFunction(({ key, runtimeId }) => {
      try { return JSON.parse(localStorage.getItem(key))?.runtimeId === runtimeId; } catch { return false; }
    }, { key, runtimeId });
  };
  const cleanCopy = async (page) => {
    const text = await page.locator('body').innerText();
    for (const phrase of ['勾选即保存', '已从本地文件读取进度', '已保存到 progress.json', '可逐级收纳', '保留自己的解题过程',
      'A PERSONAL LEARNING ROADMAP', 'RELATED KNOWLEDGE', 'THE ALGORITHM HANDBOOK', '把方法看懂', '按知识前置顺序练习',
      '进度文件：', 'YOUR PROGRESS', 'THE ROADMAP']) assert(!text.includes(phrase), 'Redundant copy remains: ' + phrase);
  };
  const headingTop = (page, id) => page.locator('#' + id).evaluate((heading) => heading.getBoundingClientRect().top);
  try {
    await fs.mkdir(path.join(temporary, 'public'));
    await fs.mkdir(path.join(temporary, 'data'));
    if (screenshotDir) await fs.mkdir(screenshotDir, { recursive: true });
    for (const file of ['server.js', 'hot100-50-day-plan.md']) await fs.copyFile(path.join(project, file), path.join(temporary, file));
    for (const file of ['index.html', 'app.css', 'app.js', 'knowledge.html', 'knowledge.css', 'knowledge.js', 'knowledge-data.js', 'favicon.svg'])
      await fs.copyFile(path.join(project, 'public', file), path.join(temporary, 'public', file));
    // A test-only preload reuses the origin after a real restart, exposing stale-state bugs.
    await fs.writeFile(path.join(temporary, 'test-port.cjs'), "const http = require('node:http');\nconst listen = http.Server.prototype.listen;\nconst port = Number(process.argv.find(arg => arg.startsWith('--test-port='))?.split('=')[1]) || 0;\nhttp.Server.prototype.listen = function(value, ...args) { return listen.call(this, port || value, ...args); };\n");
    const progressFile = path.join(temporary, 'data', 'progress.json');
    await fs.writeFile(progressFile, fixtureBytes);
    let url = await start();
    const session = await (await fetch(url + 'api/session')).json();
    assert.equal(session.id, (await (await fetch(url + 'api/session')).json()).id);
    const plan = await (await fetch(url + 'api/plan')).json();
    assert.equal(plan.stages.length, 8);
    const days = plan.stages.flatMap((stage) => stage.days);
    assert.equal(days.length, 50);
    assert(days.every((day, i) => day.number === i + 1 && day.questions.length === 2));
    assert.equal(new Set(days.flatMap((day) => day.questions.map((question) => question.id))).size, 100);
    for (const route of ['knowledge', 'knowledge.js', 'knowledge.css', 'knowledge-data.js', 'favicon.svg', 'api/session']) {
      const response = await fetch(url + route);
      assert.equal(response.status, 200);
      assert(response.headers.get('content-security-policy').includes("script-src 'self'"));
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      if (route === 'favicon.svg') assert(response.headers.get('content-type').startsWith('image/svg+xml'));
    }
    assert.equal((await fetch(url + 'missing-file.js')).status, 404);
    for (const route of ['api/plan', 'api/session']) assert.equal(await new Promise((resolve, reject) =>
      http.get(url + route, { headers: { Host: 'example.com' } }, (response) => { response.resume(); resolve(response.statusCode); }).on('error', reject)), 403);
    browser = await chromium.launch({ executablePath: process.argv[3] ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });

    const previewContext = await contextFor();
    const preview = await previewContext.newPage();
    const fixed = { categories: [{ id: 'api', title: 'Java 常用 API' }], topics: [
      { id: 'hashmap', category: 'api', title: 'HashMap · 键值映射', aliases: [], summary: '按键查找、记录频率与建立分组。', problems: [1], sources: [], sections: [
        { id: 'quick', title: '常用方法速查', headers: ['方法名', '功能描述'], rows: [['put(K key, V value)', '添加或更新键值对'], ['get(Object key)', '根据键获取值'], ['containsKey(Object key)', '判断是否包含指定的键']] },
        { id: 'example', title: 'Java 示例', code: 'Map<String, Integer> counts = new HashMap<>();\ncounts.put("apple", 2);\nSystem.out.println(counts.get("apple"));\n// Keep <script> and "quoted comments" as plain text.' },
        { id: 'rank-body', title: '正文样例', paragraphs: ['A lookup body match.'], code: '// A lookup code match in the same section.' },
        { id: 'rank-code', title: '代码样例', code: 'System.out.println("lookup");' },
        { id: 'rank-title', title: 'lookup · 标题样例', paragraphs: ['A lookup body match.'], code: '// A lookup code match.' },
      ] },
    ] };
    await preview.route('**/knowledge-data.js', (route) => route.fulfill({ contentType: 'text/javascript', body: 'window.Hot100Knowledge = ' + JSON.stringify(fixed) + ';' }));
    await preview.goto(url);
    assert.equal(await preview.locator('link[rel="icon"]').getAttribute('href'), '/favicon.svg');
    assert.equal(await preview.evaluate(async () => {
      const icon = new Image();
      icon.src = document.querySelector('link[rel="icon"]').href;
      await icon.decode();
      return icon.naturalWidth === 38 && icon.naturalHeight === 38;
    }), true, 'Favicon failed to load under the application CSP');
    await button(preview, '1. 两数之和 的相关知识').click();
    assert.notEqual(await preview.locator('.related-full-link').getAttribute('target'), '_blank', 'Full library must open in the current tab');
    assert.equal(await preview.locator('dialog .reader-sidebar').count(), 0);
    assert.equal(await preview.locator('dialog .method-table th').count(), 2);
    const previewBox = await preview.locator('dialog').boundingBox();
    assert(previewBox.x > 20 && previewBox.y > 20);
    assert.equal(await preview.locator('dialog pre code').first().textContent(), fixed.topics[0].sections[1].code);
    assert.equal(await preview.locator('dialog pre code script').count(), 0);
    assert(await preview.locator('dialog .syntax-keyword').count() > 0);
    await shot(preview, 'knowledge-modal-fixed');
    await button(preview, '关闭相关知识').click();
    await shot(preview, 'tracker-fixed');
    await preview.goto(url + 'knowledge');
    assert.equal(await preview.locator('link[rel="icon"]').getAttribute('href'), '/favicon.svg');
    await ready(preview, session.id);
    assert.equal(await preview.locator('.directory-link:visible').count(), 1);
    await shot(preview, 'knowledge-initial-fixed');
    await button(preview, 'Java 常用 API').click();
    assert.equal(await preview.locator('.level-3 .directory-link:visible').count(), 0);
    await button(preview, 'HashMap · 键值映射').click();
    await shot(preview, 'knowledge-expanded-fixed');
    const fixedSearch = preview.getByRole('searchbox', { name: '搜索知识库', exact: true });
    await fixedSearch.fill('lookup'); await fixedSearch.press('Enter');
    assert.equal(await preview.locator('.heading-directory').isVisible(), false);
    assert.equal(await preview.locator('.sidebar-results .search-result').count(), 3, 'Repeated field matches must be deduplicated by section');
    assert.deepEqual(await preview.locator('.search-result').evaluateAll((links) => links.map((link) => link.getAttribute('href'))),
      ['#kb-hashmap-rank-title', '#kb-hashmap-rank-body', '#kb-hashmap-rank-code']);
    assert.equal(await preview.locator('.search-result').first().evaluate((link) => link === document.activeElement), true);
    assert.equal(await preview.locator('.search-result').nth(1).locator('.result-source').textContent(), '正文、代码命中');
    assert(await preview.locator('.search-result').last().locator('.result-code mark').count() > 0);
    await preview.locator('.search-result').nth(1).click();
    assert.equal(await preview.locator('.sidebar-results').isVisible(), true);
    await preview.locator('.search-result').last().click();
    assert.equal(await preview.locator('#kb-hashmap-rank-code').evaluate((heading) => getComputedStyle(heading).outlineStyle), 'none');
    await preview.locator('.search-result').first().focus();
    await preview.keyboard.press('Enter');
    assert.equal(await preview.locator('#kb-hashmap-rank-title').evaluate((heading) => document.activeElement === heading), true);
    assert.equal(await preview.locator('#kb-hashmap-rank-title').evaluate((heading) => getComputedStyle(heading).outlineStyle), 'solid');
    await preview.locator('.search-result').last().click();
    const fixedReadingTop = await headingTop(preview, 'kb-hashmap-rank-code');
    await shot(preview, 'knowledge-search-fixed');
    await button(preview, '清空知识库搜索').click();
    assert.equal(await fixedSearch.inputValue(), '');
    assert.equal(await button(preview, 'HashMap · 键值映射').getAttribute('aria-expanded'), 'true');
    assert(Math.abs((await headingTop(preview, 'kb-hashmap-rank-code')) - fixedReadingTop) < 4, 'Clearing search lost selected reading position');
    assert.equal(await preview.locator('.directory-row.is-active').evaluate((row) => getComputedStyle(row).borderLeftWidth), '0px');
    await previewContext.close();
    if (process.argv.includes('--preview')) { assert.deepEqual(errors, []); console.log('Fixed-data preview passed'); return; }

    const context = await contextFor();
    const page = await context.newPage();
    await page.goto(url + 'knowledge');
    await ready(page, session.id);
    await cleanCopy(page);
    assert.equal(await page.locator('.knowledge-topbar').count(), 0, 'Full-width header still occupies reading space');
    assert.equal(await page.locator('input[type=search]').count(), 1, 'Search entrances were not unified');
    assert.equal((await page.locator('.reader-toolbar').boundingBox()).y, 0);
    assert.equal(await page.locator('.directory-link:visible').count(), 3);
    assert.equal(await page.locator('.level-3 .directory-link:visible').count(), 0);
    assert.equal(await page.locator('.directory-toggle, .directory-spacer').count(), 0);
    assert.equal(await page.locator('.knowledge-topic').count(), 41);
    const expectedCode = Object.fromEntries(catalog.topics.flatMap((topic) => topic.sections
      .filter((section) => section.code).map((section) => [`kb-${topic.id}-${section.id}`, section.code])));
    const renderedCode = await page.locator('.code-example pre code').evaluateAll((blocks) => Object.fromEntries(blocks
      .map((code) => [code.closest('.topic-section').querySelector('h3').id, code.textContent])));
    assert.deepEqual(renderedCode, expectedCode, 'Syntax highlighting changed source code');
    assert.equal(await page.locator('.code-example pre script, .code-example pre img').count(), 0);
    for (const token of ['keyword', 'string', 'number', 'type', 'comment']) {
      assert(await page.locator('.syntax-' + token).count() > 0, 'Missing Java token: ' + token);
    }
    assert.equal(await page.locator('.code-example').first().evaluate((block) => getComputedStyle(block).backgroundColor), 'rgb(247, 250, 255)');
    assert.equal(await page.evaluate(() => window.scrollY), 0);
    assert.equal(await page.locator('.method-table').count(), 10);
    assert.equal(await page.locator('.method-table').evaluateAll((tables) => tables.every((table) =>
      table.querySelectorAll('th').length === 2 && [...table.querySelectorAll('tbody tr')].every((row) =>
        row.children.length === 2 && row.firstElementChild.querySelector('code') && !row.firstElementChild.textContent.includes(' / ')))), true);
    await button(page, 'Java 常用 API').click();
    assert.equal(await page.locator('#kb-category-api-children').isVisible(), true);
    assert.equal(await page.locator('.level-3 .directory-link:visible').count(), 0);
    assert.equal(await button(page, 'Java 常用 API').evaluate((item) => item === document.activeElement), true);
    await button(page, 'HashMap · 键值映射').click();
    assert.equal(await button(page, 'HashMap · 键值映射').getAttribute('aria-expanded'), 'true');
    await button(page, 'HashSet · 去重与判重').click();
    assert.equal(await button(page, 'HashMap · 键值映射').getAttribute('aria-expanded'), 'false');
    assert.equal(await button(page, 'HashSet · 去重与判重').getAttribute('aria-expanded'), 'true');
    assert.equal(await page.evaluate(() => location.hash), '');
    assert.equal(await page.evaluate(() => window.scrollY), 0);
    await button(page, 'Java 常用 API').click(); await button(page, 'Java 常用 API').click();
    assert.equal(await button(page, 'HashMap · 键值映射').getAttribute('aria-expanded'), 'false');
    assert.equal(await button(page, 'HashSet · 去重与判重').getAttribute('aria-expanded'), 'false');
    assert.equal(await page.locator('.level-3 .directory-link:visible').count(), 0);
    await button(page, '基础算法与数据结构').click();
    assert.equal(await button(page, 'Java 常用 API').getAttribute('aria-expanded'), 'false');
    await button(page, 'Java 常用 API').click();
    await button(page, 'HashSet · 去重与判重').click();
    const full = page.getByRole('searchbox', { name: '搜索知识库', exact: true, includeHidden: true });
    const search = async (value) => {
      if (!await page.locator('.reader-sidebar').isVisible()) await button(page, '目录与搜索').click();
      await full.fill(value); await full.press('Enter');
    };
    const initialReadingTop = await headingTop(page, 'kb-category-api');
    await search('getOrDefault');
    assert.equal(await page.locator('.heading-directory').isVisible(), false);
    assert.equal(await page.locator('.sidebar-results').isVisible(), true);
    assert.equal(await page.locator('.reader-content .sidebar-results').count(), 0);
    assert(Math.abs((await headingTop(page, 'kb-category-api')) - initialReadingTop) < 4, 'Search displaced the document');
    await search('HashMap');
    assert((await page.locator('.search-result').first().locator('.result-title').innerText()).includes('HashMap'));
    await button(page, '清空知识库搜索').click();
    assert.equal(await page.locator('#kb-topic-hashmap-children').isVisible(), false);
    assert.equal(await button(page, 'HashSet · 去重与判重').getAttribute('aria-expanded'), 'true');
    await search('unlikely-title-987654');
    assert.equal(await page.locator('.search-empty').innerText(), '无结果');
    await full.press('Escape');
    assert.equal(await page.locator('.heading-directory').isVisible(), true);
    await button(page, 'HashMap · 键值映射').click();
    await search('HashMap getOrDefault');
    assert((await page.locator('.search-result').first().innerText()).includes('getOrDefault()'));
    assert(await page.locator('.sidebar-results mark').count() > 0);
    await page.locator('.search-result').first().click();
    await page.waitForFunction(() => document.querySelector('[aria-current="location"]')?.getAttribute('href') === '#kb-hashmap-get-or-default');
    assert.equal(await page.locator('.sidebar-results').isVisible(), true);
    assert.equal(await full.inputValue(), 'HashMap getOrDefault');
    assert.equal(await page.locator('.search-result.is-current').count(), 1);
    const selectedReadingTop = await headingTop(page, 'kb-hashmap-get-or-default');
    await button(page, '清空知识库搜索').click();
    assert(Math.abs((await headingTop(page, 'kb-hashmap-get-or-default')) - selectedReadingTop) < 4);
    assert.equal(await page.locator('.directory-row.is-active').count(), 1);
    assert.equal(await page.locator('.directory-row.contains-active').count(), 0);
    assert.equal(await page.locator('a[href="#kb-hashmap-get-or-default"]').getAttribute('aria-expanded'), null);
    assert.equal(await page.locator('.directory-row.is-active').evaluate((row) => getComputedStyle(row).borderLeftWidth), '0px');
    const copy = page.locator('#kb-hashmap-get-or-default').locator('..').locator('.copy-code');
    const originalCode = catalog.topics.find((topic) => topic.id === 'hashmap').sections.find((section) => section.id === 'get-or-default').code;
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {
      configurable: true, value: { writeText: async (text) => { window.testCopiedCode = text; } },
    }));
    await copy.click();
    assert.equal(await copy.innerText(), '已复制');
    assert.equal(await page.evaluate(() => window.testCopiedCode), originalCode);
    assert.equal(await copy.getAttribute('data-state'), 'success');
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {
      configurable: true, value: { writeText: async () => { throw new Error('Clipboard unavailable'); } },
    }));
    await copy.click();
    assert.equal(await copy.innerText(), '复制失败');
    await page.waitForFunction(() => document.querySelector('#kb-hashmap-get-or-default').parentElement.querySelector('.copy-code').textContent === '复制代码');
    await page.waitForTimeout(1100);
    await page.evaluate(() => {
      const heading = document.getElementById('kb-hashmap-compute-if-absent');
      window.scrollTo({ top: window.scrollY + heading.getBoundingClientRect().top - document.querySelector('.reader-toolbar').getBoundingClientRect().bottom - 18, behavior: 'instant' });
    });
    await page.waitForFunction(() => document.querySelector('[aria-current="location"]')?.getAttribute('href') === '#kb-hashmap-compute-if-absent');
    await button(page, 'HashMap · 键值映射').click();
    assert.equal(await button(page, 'HashMap · 键值映射').evaluate((item) => item.parentElement.classList.contains('contains-active')), true);
    assert.equal(await page.locator('.directory-row.is-active').count(), 0);
    assert.equal(await page.locator('.directory-row.contains-active').count(), 1);
    await button(page, 'HashMap · 键值映射').click();
    assert.equal(await page.locator('.directory-row.contains-active').count(), 0);
    assert.equal(await page.locator('.directory-row.is-active').count(), 1);
    await button(page, 'HashMap · 键值映射').click();
    const beforeHide = await headingTop(page, 'kb-hashmap-compute-if-absent');
    await button(page, '收起目录').click();
    assert(Math.abs((await headingTop(page, 'kb-hashmap-compute-if-absent')) - beforeHide) < 4);
    assert.equal(await page.locator('.toolbar-back').isVisible(), true);
    await button(page, '目录与搜索').click();
    await search('Math.multiplyExact'); assert(await page.locator('.search-result').count() > 0);
    await search('<img src=x onerror=alert(1)>');
    assert.equal(await page.locator('.search-empty').innerText(), '无结果');
    assert.equal(await page.locator('.sidebar-results img').count(), 0);
    await search('['); assert(await page.locator('.search-result').count() > 0);

    await page.goto(url + 'knowledge#kb-binary-search-template');
    await ready(page, session.id);
    await page.waitForFunction(() => document.querySelector('[aria-current="location"]')?.getAttribute('href') === '#kb-binary-search-template');
    const targetTop = await headingTop(page, 'kb-binary-search-template');
    assert(targetTop >= 48 && targetTop < 120);
    await page.waitForTimeout(1100);
    await button(page, '二分查找 · 边界与区间').click();
    await page.evaluate(() => window.scrollBy({ top: 48, behavior: 'instant' }));
    await page.waitForTimeout(160);
    await search('HashMap');
    await button(page, '收起目录').click();
    const readingTop = await headingTop(page, 'kb-binary-search-template');
    await page.locator('.toolbar-back').click(); await page.locator('.knowledge-entry').click();
    await ready(page, session.id);
    assert.equal(await full.inputValue(), '');
    assert.equal(await page.locator('.sidebar-results').isVisible(), false);
    assert.equal(await page.locator('.reader-sidebar').isVisible(), false);
    assert(Math.abs((await headingTop(page, 'kb-binary-search-template')) - readingTop) < 4, 'Return lost paragraph position');
    await button(page, '目录与搜索').click();
    assert.equal(await button(page, '二分查找 · 边界与区间').getAttribute('aria-expanded'), 'false');
    const reloadTop = await headingTop(page, 'kb-binary-search-template');
    await page.reload(); await ready(page, session.id);
    assert(Math.abs((await headingTop(page, 'kb-binary-search-template')) - reloadTop) < 4, 'Reload lost paragraph position');
    assert.equal(await button(page, '二分查找 · 边界与区间').getAttribute('aria-expanded'), 'false');
    await page.locator('.back-to-plan:visible').click(); await page.goBack(); await ready(page, session.id);
    assert(Math.abs((await headingTop(page, 'kb-binary-search-template')) - reloadTop) < 4, 'Back navigation lost paragraph position');

    await page.goto(url); await page.locator('.related-knowledge').first().waitFor();
    await cleanCopy(page);
    assert.equal(await page.locator('#save-status').isVisible(), false);
    assert.equal(await page.locator('.related-knowledge').count(), 100);
    assert.equal(await page.locator('#done-count').innerText(), '1');
    assert.equal(await page.locator('.note-input').first().inputValue(), fixture.items[1].note);
    await page.locator('#day-1').scrollIntoViewIfNeeded();
    const scrollBefore = await page.evaluate(() => window.scrollY);
    const related = button(page, '1. 两数之和 的相关知识');
    await related.click(); await cleanCopy(page);
    const box = await page.locator('dialog').boundingBox();
    assert(box.x > 20 && box.y > 20 && Math.abs(box.x + box.width / 2 - 720) < 10);
    assert.equal(await page.locator('dialog .reader-sidebar, dialog .knowledge-category > h1, dialog .eyebrow').count(), 0);
    assert.equal(await page.locator('dialog .knowledge-topic').count(), 1);
    assert.equal(await page.locator('dialog .topic-section').count(), catalog.topics.find((topic) => topic.id === 'hashmap').sections.length + 1);
    assert.equal(await page.locator('.chapter-menu').isVisible(), false);
    await button(page, '章节').click();
    await page.locator('.chapter-menu a[href="#related-hashmap-get-or-default"]').click();
    assert.equal(await page.locator('.chapter-menu').isVisible(), false);
    await page.waitForFunction(() => document.querySelector('.chapter-link[aria-current]')?.getAttribute('href') === '#related-hashmap-get-or-default');
    await button(page, '章节').click(); await page.keyboard.press('Escape');
    assert.equal(await page.locator('.chapter-menu').isVisible(), false);
    assert.equal(await page.locator('dialog').isVisible(), true);
    await page.getByRole('tab').last().click();
    assert.equal(await page.getByRole('tab').last().getAttribute('aria-selected'), 'true');
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.getByRole('tab').first().getAttribute('aria-selected'), 'true');
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.querySelector('dialog').contains(document.activeElement)), true);
    }
    const followRelatedAndBack = async (target, currentContext, screenshotName) => {
      const selected = target.getByRole('tab', { selected: true });
      const topicId = await selected.getAttribute('data-topic');
      const reading = await target.evaluate(() => ({ tracker: scrollY, article: document.querySelector('dialog .reader-content').scrollTop }));
      await target.evaluate(() => { window.relatedReturnProbe = true; });
      const pageCount = currentContext.pages().length;
      assert.equal(await target.locator('.related-full-link').textContent(), '完整知识库 ↗');
      await Promise.all([
        target.waitForURL(url + 'knowledge#kb-topic-' + topicId),
        target.locator('.related-full-link').click(),
      ]);
      await ready(target, session.id);
      assert.equal(currentContext.pages().length, pageCount, 'Full library opened another tab');
      assert((await headingTop(target, 'kb-topic-' + topicId)) < 210, 'Selected topic deep link failed');
      await target.goBack();
      await target.locator('dialog[open]').waitFor();
      const restored = ({ topicId, reading }) =>
        document.querySelector('.related-topic-choice[aria-selected="true"]')?.dataset.topic === topicId
        && Math.abs(document.querySelector('dialog .reader-content').scrollTop - reading.article) < 2
        && Math.abs(scrollY - reading.tracker) < 2;
      await target.waitForFunction(restored, { topicId, reading });
      assert.equal(await target.evaluate(() => window.relatedReturnProbe === true), false, 'Uncached history path was not exercised');
      // The service's no-store responses prevent caching in this browser. Exercise
      // the persisted-pageshow handler with the live modal still in the document.
      await target.evaluate(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
        document.querySelector('dialog .reader-content').scrollTop = 0;
        window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
      });
      await target.waitForFunction(restored, { topicId, reading });
      assert.equal(await target.locator('body').evaluate((body) => body.classList.contains('knowledge-dialog-open')), true);
      if (screenshotName) await shot(target, screenshotName);
    };
    await page.locator('dialog .reader-content').evaluate((content) => { content.scrollTop = 340; });
    await followRelatedAndBack(page, context, 'knowledge-modal-return');
    await page.getByRole('tab').last().click();
    await page.locator('dialog .reader-content').evaluate((content) => { content.scrollTop = 180; });
    await followRelatedAndBack(page, context);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('dialog').isVisible(), false);
    assert.equal(await page.evaluate(() => Boolean(history.state?.hot100Related)), false, 'Closing left a stale modal snapshot');
    assert(Math.abs((await page.evaluate(() => window.scrollY)) - scrollBefore) < 2);
    assert.equal(await related.evaluate((item) => document.activeElement === item), true);
    await related.click(); await page.mouse.click(15, 15);
    assert.equal(await page.locator('dialog').isVisible(), false);
    const laterRelated = page.locator('#day-35 .related-knowledge').last();
    await laterRelated.click();
    assert(await page.evaluate(() => scrollY > 1000), 'Later-question fixture did not exercise tracker scrolling');
    await page.locator('dialog .reader-content').evaluate((content) => { content.scrollTop = 220; });
    await followRelatedAndBack(page, context);
    await page.reload();
    await page.locator('.related-knowledge').first().waitFor();
    assert.equal(await page.locator('dialog[open]').count(), 0, 'Refresh unexpectedly reopened the modal');
    assert.equal(await page.evaluate(() => Boolean(history.state?.hot100Related)), false, 'Refresh retained a stale modal snapshot');

    const mobileContext = await contextFor({ width: 390, height: 844 });
    const mobile = await mobileContext.newPage();
    await mobile.goto(url + 'knowledge'); await ready(mobile, session.id);
    assert.equal(await mobile.locator('.reader-sidebar').isVisible(), false);
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    assert.equal(await mobile.locator('.toolbar-back').isVisible(), true);
    await button(mobile, '目录与搜索').click();
    assert.equal(await mobile.locator('.directory-link:visible').count(), 3);
    const mobileSearch = mobile.getByRole('searchbox', { name: '搜索知识库', exact: true, includeHidden: true });
    await mobileSearch.fill('getOrDefault'); await mobileSearch.press('Enter');
    await mobile.locator('.sidebar-results a[href="#kb-hashmap-get-or-default"]').click();
    assert.equal(await mobile.locator('.reader-sidebar').isVisible(), false);
    assert.equal(await mobileSearch.inputValue(), 'getOrDefault');
    await button(mobile, '目录与搜索').click();
    assert.equal(await mobile.locator('.sidebar-results').isVisible(), true);
    await mobile.setViewportSize({ width: 320, height: 700 });
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await mobile.locator('.reader-sidebar').evaluate((sidebar) => sidebar.scrollWidth <= sidebar.clientWidth), true);
    await mobile.setViewportSize({ width: 390, height: 844 });
    await mobile.goto(url); await button(mobile, '1. 两数之和 的相关知识').click();
    assert.equal(await mobile.locator('dialog .reader-sidebar').count(), 0);
    assert.equal(await mobile.locator('dialog').evaluate((item) => item.scrollWidth <= item.clientWidth), true);
    assert.equal(await mobile.locator('dialog .method-table').evaluate((table) => table.scrollWidth <= table.clientWidth), true);
    const descriptionBox = await mobile.locator('dialog .method-table th').last().boundingBox();
    assert(descriptionBox.x >= 0 && descriptionBox.x + descriptionBox.width <= 390, 'Mobile hides the description column');
    await button(mobile, '章节').click();
    const menu = await mobile.locator('.chapter-menu').boundingBox();
    assert(menu.x >= 0 && menu.x + menu.width <= 390);
    await mobile.locator('.chapter-menu a[href="#related-hashmap-compute-if-absent"]').click();
    assert.equal(await mobile.locator('.chapter-menu').isVisible(), false);
    await followRelatedAndBack(mobile, mobileContext, 'knowledge-modal-mobile-return');
    await button(mobile, '关闭相关知识').click();
    await mobile.setViewportSize({ width: 320, height: 700 });
    await button(mobile, '1. 两数之和 的相关知识').click();
    assert.equal(await mobile.locator('dialog').evaluate((item) => item.scrollWidth <= item.clientWidth), true);
    assert.equal(await mobile.locator('dialog .method-table').evaluate((table) => table.scrollWidth <= table.clientWidth), true);
    await button(mobile, '关闭相关知识').click();
    await mobile.setViewportSize({ width: 390, height: 844 });
    assert.equal(writes, 0, 'Knowledge issued a progress write');
    assert.equal(await fs.readFile(progressFile, 'utf8'), fixtureBytes);

    await page.goto(url + 'knowledge#kb-binary-search-template');
    await ready(page, session.id);
    await page.waitForFunction(() => location.hash === '#kb-binary-search-template');
    const port = Number(new URL(url).port);
    await stop(); url = await start(port);
    const nextSession = await (await fetch(url + 'api/session')).json();
    assert.notEqual(nextSession.id, session.id);
    await page.reload(); await ready(page, nextSession.id);
    assert.equal(await page.evaluate(() => window.scrollY), 0);
    assert.equal(await page.evaluate(() => location.hash), '');
    assert.equal(await page.locator('.directory-link:visible').count(), 3);
    assert.equal(await page.locator('.level-3 .directory-link:visible').count(), 0);
    assert.equal(await page.locator('.reader-sidebar').isVisible(), true);

    const legacyContext = await contextFor();
    const legacy = await legacyContext.newPage();
    await legacy.addInitScript(({ key, runtimeId }) => localStorage.setItem(key, JSON.stringify({
      runtimeId, collapsed: [], hidden: false,
      reading: { atTop: false, anchor: 'kb-binary-search-template', offset: 18 },
    })), { key, runtimeId: nextSession.id });
    await legacy.goto(url + 'knowledge'); await ready(legacy, nextSession.id);
    assert.equal(await legacy.locator('.level-1 > .directory-row > .directory-parent[aria-expanded="true"]').count(), 1);
    assert.equal(await legacy.locator('.level-2 > .directory-row > .directory-parent[aria-expanded="true"]').count(), 1);
    assert.equal(await button(legacy, '基础算法与数据结构').getAttribute('aria-expanded'), 'true');
    assert.equal(await button(legacy, '二分查找 · 边界与区间').getAttribute('aria-expanded'), 'true');
    assert((await headingTop(legacy, 'kb-binary-search-template')) < 210);
    const legacyTop = await headingTop(legacy, 'kb-binary-search-template');
    await button(legacy, '基础算法与数据结构').click();
    await button(legacy, '基础算法与数据结构').click();
    assert.equal(await legacy.locator('.level-3 .directory-link:visible').count(), 0);
    assert(Math.abs((await headingTop(legacy, 'kb-binary-search-template')) - legacyTop) < 4);
    await legacyContext.close();

    const failure = await context.newPage();
    await failure.route('**/api/plan', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"Unavailable"}' }));
    await failure.goto(url + 'knowledge'); await failure.locator('.knowledge-warning').waitFor();
    assert.equal(await failure.locator('.knowledge-warning').innerText(), '关联练习加载失败');
    assert.equal(await failure.locator('.knowledge-topic').count(), 41);
    const denied = await context.newPage();
    await denied.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage disabled'); } }));
    await denied.goto(url + 'knowledge'); await denied.locator('.directory-tree').waitFor({ state: 'attached' });
    await button(denied, 'Java 常用 API').click();
    await button(denied, 'HashMap · 键值映射').click();
    assert.equal(await denied.locator('#kb-topic-hashmap-children').isVisible(), true);
    await denied.close();

    await page.goto(url); await page.locator('.note-input').first().waitFor();
    let failSave = true;
    await page.route('**/api/progress', (route) => route.request().method() === 'PUT'
      ? route.fulfill({ status: failSave ? 503 : 200, contentType: 'application/json', body: failSave ? '{"error":"Unavailable"}' : '{"saved":true}' })
      : route.continue());
    await page.locator('.note-input').first().fill('Unsaved fixture edit'); await page.locator('.note-input').first().blur();
    await page.locator('#save-status').waitFor();
    assert.equal(await page.locator('#save-status').innerText(), '保存失败');
    failSave = false;
    await page.locator('.note-input').first().fill('Recovered fixture edit'); await page.locator('.note-input').first().blur();
    await page.locator('#save-status').waitFor({ state: 'hidden' });
    assert.equal(await fs.readFile(progressFile, 'utf8'), fixtureBytes);
    await page.unroute('**/api/progress');
    const loadFailure = await context.newPage();
    await loadFailure.route('**/api/progress', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"Unavailable"}' }));
    await loadFailure.goto(url); await loadFailure.locator('#save-status').waitFor();
    assert.equal(await loadFailure.locator('#save-status').innerText(), '加载失败');
    await loadFailure.close();
    if (screenshotDir) {
      await page.goto(url + 'knowledge'); await ready(page, nextSession.id); await shot(page, 'knowledge-desktop');
      await button(page, 'Java 常用 API').click();
      await button(page, 'HashMap · 键值映射').click();
      await page.locator('a[href="#kb-hashmap-compute-if-absent"]').click();
      await shot(page, 'knowledge-desktop-expanded');
      await search('computeIfAbsent');
      await page.locator('.sidebar-results a[href="#kb-hashmap-compute-if-absent"]').click();
      await shot(page, 'knowledge-desktop-search');
      await button(page, '清空知识库搜索').click();
      await mobile.goto(url + 'knowledge'); await ready(mobile, nextSession.id); await shot(mobile, 'knowledge-mobile');
      await button(mobile, '目录与搜索').click();
      await button(mobile, 'Java 常用 API').click();
      await button(mobile, 'HashMap · 键值映射').click();
      await shot(mobile, 'knowledge-mobile-expanded');
      await mobileSearch.fill('computeIfAbsent'); await mobileSearch.press('Enter');
      await shot(mobile, 'knowledge-mobile-search');
      await mobile.locator('.sidebar-results a[href="#kb-hashmap-compute-if-absent"]').click();
      await shot(mobile, 'knowledge-mobile-reading');
      await button(mobile, '目录与搜索').click();
      assert.equal(await mobileSearch.inputValue(), 'computeIfAbsent');
      await shot(mobile, 'knowledge-mobile-search-restored');
      await page.goto(url); await page.locator('.related-knowledge').first().waitFor(); await shot(page, 'tracker-desktop');
      await button(page, '1. 两数之和 的相关知识').click(); await shot(page, 'knowledge-modal');
      await button(page, '章节').click(); await shot(page, 'knowledge-modal-chapters');
      await mobile.goto(url); await button(mobile, '1. 两数之和 的相关知识').click(); await shot(mobile, 'knowledge-modal-mobile');
      await button(mobile, '关闭相关知识').click();
      await shot(mobile, 'tracker-mobile');
      await mobile.setViewportSize({ width: 320, height: 700 });
      assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await shot(mobile, 'tracker-mobile-narrow');
      await mobile.setViewportSize({ width: 390, height: 844 });
    }
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ httpContracts: 'passed', cleanCopy: 'passed', methodTables: 'passed', directory: 'passed',
      searchAndHighlight: 'passed', returnAndReload: 'passed', sameOriginRestart: 'passed', centeredModal: 'passed',
      chapterNavigation: 'passed', keyboardAndFocus: 'passed', mobile: 'passed', failureStates: 'passed',
      exclusiveBranches: 'passed', oneLevelExpansion: 'passed', safeSyntaxHighlighting: 'passed', codeCopyFeedback: 'passed',
      legacyReadingState: 'passed',
      unifiedSidebarSearch: 'passed', preservedSearchResults: 'passed', searchRankingAndDeduplication: 'passed',
      borderlessSelection: 'passed', compactReadingToolbar: 'passed', sameTabRelatedNavigation: 'passed', relatedHistoryRestoration: 'passed',
      relatedHistoryReload: 'passed', persistedPageshowHandler: 'passed', staleModalCleanup: 'passed',
      knowledgeWrites: 0, fixtureProgressUnchanged: true, browserErrors: 0 }));
  } finally {
    await browser?.close(); await stop();
    assert.equal(path.dirname(path.resolve(temporary)), path.resolve(os.tmpdir()));
    assert(path.basename(temporary).startsWith('hot100-browser-'));
    await fs.rm(temporary, { recursive: true, force: true });
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
