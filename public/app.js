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
  saveQueue = saveQueue.catch(() => {}).then(async () => {
    const response = await fetch('/api/progress', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Hot100-Request': '1' },
      body: snapshot,
    });
    if (!response.ok) throw new Error('保存失败');
    if (revision === saveRevision) {
      saveStatus.textContent = '';
      saveStatus.hidden = true;
      saveStatus.classList.remove('error');
    }
  }).catch(() => {
    if (revision === saveRevision) {
      saveStatus.textContent = '保存失败';
      saveStatus.hidden = false;
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
  [['', '未选择'], ['A', 'A · 独立'], ['B', 'B · 提示'], ['C', 'C · 题解']].forEach(([value, text]) => {
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
  note.placeholder = '笔记';
  note.value = item.note;
  note.setAttribute('aria-label', `${question.id}. ${question.title} 的复盘笔记`);
  note.addEventListener('change', () => setItem(question.id, { note: note.value.trim() }));
  meta.append(selectLabel, note);
  row.append(head, meta);
  const knowledgeButton = element('button', 'related-knowledge', '相关知识 ↗');
  knowledgeButton.type = 'button';
  knowledgeButton.setAttribute('aria-label', `${question.id}. ${question.title} 的相关知识`);
  knowledgeButton.addEventListener('click', () => window.Hot100KnowledgeUI.openRelated(question, state.stages));
  row.append(knowledgeButton);
  return row;
}

function render() {
  state.stages.forEach((stage) => {
    const navLink = element('a', 'nav-link');
    navLink.href = `#stage-${stage.number}`;
    navLink.addEventListener('click', () => {
      stageNav.querySelectorAll('a').forEach((link) => link.removeAttribute('aria-current'));
      navLink.setAttribute('aria-current', 'location');
    });
    navLink.append(element('span', 'nav-number', String(stage.number).padStart(2, '0')),
      element('span', '', stage.title), element('span', 'nav-arrow', '↗'));
    stageNav.append(navLink);

    const section = element('section', 'stage-section');
    section.id = `stage-${stage.number}`;
    const header = element('div', 'stage-heading');
    const headingText = element('div');
    headingText.append(element('h2', '', stage.title));
    const first = stage.days[0].number;
    const last = stage.days.at(-1).number;
    header.append(headingText, element('span', 'stage-range', `DAY ${String(first).padStart(2, '0')}-${String(last).padStart(2, '0')}`));
    const grid = element('div', 'day-grid');
    stage.days.forEach((day) => {
      const card = element('article', 'day-card');
      card.id = `day-${day.number}`;
      const cardHead = element('div', 'day-head');
      cardHead.append(element('span', 'day-number', `DAY ${String(day.number).padStart(2, '0')}`));
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
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth', block: 'center' });
  };
  days.forEach((day) => {
    const card = document.getElementById(`day-${day.number}`);
    if (!card) return;
    const complete = day.questions.every((question) => itemFor(question.id).done);
    card.classList.toggle('complete', complete);
    card.classList.toggle('current', next?.number === day.number);
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
    saveStatus.textContent = '';
    saveStatus.hidden = true;
  } catch {
    saveStatus.textContent = '加载失败';
    saveStatus.hidden = false;
    saveStatus.classList.add('error');
  }
}

initialize();
