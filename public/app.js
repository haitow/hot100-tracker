const state = { stages: [], progress: { version: 1, items: {} } };
let saveQueue = Promise.resolve();
let saveRevision = 0;

const stageNav = document.getElementById('stage-nav');
const stageContainer = document.getElementById('stages');
const saveStatus = document.getElementById('save-status');
const jumpButton = document.getElementById('jump-button');

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function itemFor(id) {
  return state.progress.items[id] ?? { done: false, mastery: null, note: '' };
}

function setItem(id, changes) {
  state.progress.items[id] = { ...itemFor(id), ...changes };
  updateSummary();
  queueSave();
}

function queueSave() {
  const snapshot = JSON.stringify(state.progress);
  const revision = ++saveRevision;
  saveStatus.textContent = '正在写入 progress.json…';
  saveStatus.classList.remove('error');
  saveQueue = saveQueue.catch(() => {}).then(async () => {
    const response = await fetch('/api/progress', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Hot100-Request': '1' },
      body: snapshot,
    });
    if (!response.ok) throw new Error('保存失败');
    if (revision === saveRevision) saveStatus.textContent = '已保存到 progress.json';
  }).catch(() => {
    if (revision === saveRevision) {
      saveStatus.textContent = '保存失败，请保持页面打开并重试修改';
      saveStatus.classList.add('error');
    }
  });
}

function questionRow(question) {
  const item = itemFor(question.id);
  const row = element('div', 'question-row');
  const head = element('div', 'question-head');
  const label = element('label', 'check-wrap');
  const checkbox = element('input');
  checkbox.type = 'checkbox';
  checkbox.checked = item.done;
  checkbox.setAttribute('aria-label', `完成 ${question.id}. ${question.title}`);
  checkbox.addEventListener('change', () => setItem(question.id, { done: checkbox.checked }));
  label.append(checkbox, element('span', 'custom-check'));

  const link = element('a', 'question-link', `${question.id}. ${question.title}`);
  link.href = question.url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  const difficulty = { easy: '简单', medium: '中等', hard: '困难' }[question.difficulty];
  const badge = element('span', `difficulty ${question.difficulty}`, difficulty);
  head.append(label, link, badge);

  const meta = element('div', 'question-meta');
  const selectLabel = element('label', 'mastery-label', '掌握');
  const select = element('select', 'mastery-select');
  select.setAttribute('aria-label', `${question.id}. ${question.title} 的掌握程度`);
  [['', '—'], ['A', 'A · 独立'], ['B', 'B · 提示'], ['C', 'C · 题解']].forEach(([value, text]) => {
    const option = element('option', '', text);
    option.value = value;
    select.append(option);
  });
  select.value = item.mastery ?? '';
  select.addEventListener('change', () => setItem(question.id, { mastery: select.value || null }));
  selectLabel.append(select);

  const note = element('input', 'note-input');
  note.type = 'text';
  note.maxLength = 200;
  note.placeholder = '一句话记录卡点';
  note.value = item.note;
  note.setAttribute('aria-label', `${question.id}. ${question.title} 的复盘笔记`);
  note.addEventListener('change', () => setItem(question.id, { note: note.value.trim() }));
  meta.append(selectLabel, note);
  row.append(head, meta);
  return row;
}

function render() {
  state.stages.forEach((stage) => {
    const navLink = element('a', 'nav-link');
    navLink.href = `#stage-${stage.number}`;
    navLink.append(element('span', 'nav-number', String(stage.number).padStart(2, '0')),
      element('span', '', stage.title), element('span', 'nav-arrow', '↗'));
    stageNav.append(navLink);

    const section = element('section', 'stage-section');
    section.id = `stage-${stage.number}`;
    const header = element('div', 'stage-heading');
    const headingText = element('div');
    headingText.append(element('span', 'stage-index', `STAGE ${String(stage.number).padStart(2, '0')}`),
      element('h2', '', stage.title));
    const first = stage.days[0].number;
    const last = stage.days.at(-1).number;
    header.append(headingText, element('span', 'stage-range', `DAY ${String(first).padStart(2, '0')}—${String(last).padStart(2, '0')}`));
    const grid = element('div', 'day-grid');
    stage.days.forEach((day) => {
      const card = element('article', 'day-card');
      card.id = `day-${day.number}`;
      const cardHead = element('div', 'day-head');
      cardHead.append(element('span', 'day-number', `DAY ${String(day.number).padStart(2, '0')}`),
        element('span', 'day-state'));
      card.append(cardHead, element('h3', '', day.title));
      const questions = element('div', 'questions');
      day.questions.forEach((question) => questions.append(questionRow(question)));
      card.append(questions);
      grid.append(card);
    });
    section.append(header, grid);
    stageContainer.append(section);
  });
  updateSummary();
}

function updateSummary() {
  const days = state.stages.flatMap((stage) => stage.days);
  const questions = days.flatMap((day) => day.questions);
  const done = questions.filter((question) => itemFor(question.id).done).length;
  const completedDays = days.filter((day) => day.questions.every((question) => itemFor(question.id).done)).length;
  const review = questions.filter((question) => itemFor(question.id).mastery === 'C').length;
  const next = days.find((day) => day.questions.some((question) => !itemFor(question.id).done));
  document.getElementById('done-count').textContent = done;
  document.getElementById('day-count').textContent = completedDays;
  document.getElementById('review-count').textContent = review;
  document.getElementById('progress-fill').style.width = `${done}%`;
  document.querySelector('.progress-track').setAttribute('aria-valuenow', done);
  jumpButton.textContent = next ? `继续 Day ${String(next.number).padStart(2, '0')} ↗` : '全部完成 ✓';
  jumpButton.onclick = () => {
    const target = next ? document.getElementById(`day-${next.number}`) : document.getElementById('stages');
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  days.forEach((day) => {
    const card = document.getElementById(`day-${day.number}`);
    if (!card) return;
    const complete = day.questions.every((question) => itemFor(question.id).done);
    card.classList.toggle('complete', complete);
    card.classList.toggle('current', next?.number === day.number);
    card.querySelector('.day-state').textContent = complete ? '已完成' : next?.number === day.number ? '进行中' : '待开始';
  });
}

async function initialize() {
  try {
    const [planResponse, progressResponse] = await Promise.all([
      fetch('/api/plan'), fetch('/api/progress'),
    ]);
    if (!planResponse.ok || !progressResponse.ok) throw new Error('读取失败');
    state.stages = (await planResponse.json()).stages;
    state.progress = await progressResponse.json();
    render();
    saveStatus.textContent = '已从本地文件读取进度';
  } catch {
    saveStatus.textContent = '读取失败，请重新启动本地服务';
    saveStatus.classList.add('error');
  }
}

initialize();
