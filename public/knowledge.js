(() => {
  'use strict';

  const catalog = window.Hot100Knowledge;
  const readingKey = 'hot100.knowledge.reading';
  const normalize = (value) => String(value).normalize('NFKC').toLocaleLowerCase();
  const termsFor = (value) => normalize(value.trim()).split(/\s+/u).filter(Boolean);
  const matches = (value, terms) => terms.every((term) => normalize(value).includes(term));

  function node(tag, className, text) {
    const result = document.createElement(tag);
    if (className) result.className = className;
    if (text !== undefined) result.textContent = text;
    return result;
  }

  function button(text, className, action) {
    const result = node('button', className, text);
    result.type = 'button';
    result.addEventListener('click', action);
    return result;
  }

  function highlight(target, text, terms) {
    const lower = text.toLocaleLowerCase();
    const ranges = [];
    terms.forEach((term) => {
      let position = lower.indexOf(term);
      while (position !== -1) {
        ranges.push([position, position + term.length]);
        position = lower.indexOf(term, position + Math.max(1, term.length));
      }
    });
    ranges.sort((a, b) => a[0] - b[0]);
    const merged = [];
    ranges.forEach(([start, end]) => {
      const last = merged.at(-1);
      if (last && start <= last[1]) last[1] = Math.max(last[1], end);
      else merged.push([start, end]);
    });
    let position = 0;
    merged.forEach(([start, end]) => {
      target.append(document.createTextNode(text.slice(position, start)), node('mark', '', text.slice(start, end)));
      position = end;
    });
    target.append(document.createTextNode(text.slice(position)));
  }

  function sectionBody(section) {
    return [...(section.paragraphs ?? []), ...(section.list ?? []),
      ...(section.headers ?? []), ...(section.rows ?? []).flat()].join('\n');
  }

  function javaCode(source) {
    const code = node('code');
    const keywords = new Set(('abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while').split(' '));
    const tokens = /\/\/[^\r\n]*|\/\*[\s\S]*?\*\/|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|\b(?:0[xX][\da-fA-F_]+|\d[\d_]*(?:\.[\d_]+)?(?:[eE][+-]?[\d_]+)?)[fFdDlL]?\b|\b[A-Za-z_$][\w$]*\b/g;
    let offset = 0;
    for (const match of source.matchAll(tokens)) {
      const token = match[0];
      code.append(document.createTextNode(source.slice(offset, match.index)));
      const type = token.startsWith('//') || token.startsWith('/*') ? 'comment'
        : token.startsWith('"') || token.startsWith("'") ? 'string'
        : keywords.has(token) ? 'keyword'
        : ['true', 'false', 'null'].includes(token) ? 'literal'
        : /^\d/.test(token) ? 'number'
        : /^[A-Z]/.test(token) ? 'type' : '';
      code.append(type ? node('span', `syntax-${type}`, token) : document.createTextNode(token));
      offset = match.index + token.length;
    }
    code.append(document.createTextNode(source.slice(offset)));
    return code;
  }

  class Reader {
    constructor(root, { topics = catalog.topics, compact = false, problems = [] } = {}) {
      this.root = root;
      this.compact = compact;
      this.prefix = compact ? 'related' : 'kb';
      this.problems = new Map(problems.map((problem) => [problem.id, problem]));
      this.collapsed = new Set();
      this.query = '';
      this.activeId = '';
      this.abort = new AbortController();
      this.frame = null;
      this.pendingJump = null;
      this.buildLayout();
      this.setTopics(topics);
      if (!compact && window.matchMedia('(max-width: 720px)').matches) this.toggleSidebar({ focus: false });
      const scrollTarget = compact ? this.content : window;
      scrollTarget.addEventListener('scroll', () => this.scheduleActive(), { passive: true, signal: this.abort.signal });
      window.addEventListener('resize', () => this.scheduleActive(), { signal: this.abort.signal });
      if (!compact) {
        window.addEventListener('hashchange', () => this.jumpFromHash(), { signal: this.abort.signal });
      }
    }

    buildLayout() {
      this.workspace = node('div', `reader-workspace${this.compact ? ' compact-reader' : ''}`);
      this.content = node('main', 'reader-content');
      this.toolbar = node('div', this.compact ? 'chapter-tools' : 'reader-toolbar');
      this.document = node('div', 'knowledge-document');
      if (this.compact) {
        this.chapterButton = button('章节', 'reader-action chapter-button', () => this.setChaptersOpen(this.chapterNav.hidden));
        this.chapterButton.setAttribute('aria-expanded', 'false');
        this.chapterButton.setAttribute('aria-controls', 'related-chapters');
        this.chapterNav = node('nav', 'chapter-menu');
        this.chapterNav.id = 'related-chapters';
        this.chapterNav.hidden = true;
        this.chapterNav.setAttribute('aria-label', '当前知识点章节');
        this.toolbar.append(this.chapterButton, this.chapterNav);
        document.addEventListener('click', (event) => {
          if (!this.toolbar.contains(event.target)) this.setChaptersOpen(false);
        }, { signal: this.abort.signal });
        document.addEventListener('keydown', (event) => {
          if (event.key === 'Escape' && !this.chapterNav.hidden) {
            event.preventDefault();
            event.stopPropagation();
            this.setChaptersOpen(false, { focus: true });
          }
        }, { capture: true, signal: this.abort.signal });
        this.content.append(this.document);
        this.workspace.append(this.content);
        this.root.replaceChildren(this.workspace);
        return;
      }
      this.sidebar = node('aside', 'reader-sidebar');
      this.sidebar.setAttribute('aria-label', '知识目录');
      this.sidebar.id = 'knowledge-sidebar';
      const brand = node('div', 'sidebar-brand');
      const home = node('a', 'knowledge-home');
      home.href = '/';
      home.setAttribute('aria-label', '返回刷题计划');
      const wordmark = node('span', '', 'HOT 100');
      wordmark.append(node('small', '', '知识库'));
      home.append(node('span', 'brand-mark', 'H.'), wordmark);
      const back = node('a', 'back-to-plan', '返回计划 ↗');
      back.href = '/';
      brand.append(home, back);
      const header = node('div', 'directory-header');
      this.directoryLabel = node('span', 'directory-label', '阅读目录');
      header.append(this.directoryLabel, button('收起目录', 'directory-hide', () => this.toggleSidebar()));
      this.searchForm = node('form', 'sidebar-search');
      this.searchForm.setAttribute('role', 'search');
      this.searchForm.setAttribute('aria-label', '知识库搜索');
      this.directoryInput = node('input', 'directory-search');
      this.directoryInput.type = 'search';
      this.directoryInput.placeholder = '搜索知识库';
      this.directoryInput.maxLength = 160;
      this.directoryInput.autocomplete = 'off';
      this.directoryInput.setAttribute('aria-label', '搜索知识库');
      this.directoryInput.addEventListener('input', () => {
        clearTimeout(this.searchTimer);
        this.searchTimer = setTimeout(() => this.search(this.directoryInput.value), 120);
      });
      this.directoryInput.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && this.directoryInput.value) {
          event.preventDefault();
          event.stopPropagation();
          this.search('');
        }
      });
      this.clearSearch = button('清空', 'search-clear', () => {
        this.search('');
        this.directoryInput.focus({ preventScroll: true });
      });
      this.clearSearch.setAttribute('aria-label', '清空知识库搜索');
      this.clearSearch.hidden = true;
      this.searchForm.append(this.directoryInput, this.clearSearch);
      this.searchForm.addEventListener('submit', (event) => {
        event.preventDefault();
        this.search(this.directoryInput.value);
        this.results.querySelector('.search-result')?.focus({ preventScroll: true });
      });
      this.directory = node('nav', 'heading-directory');
      this.directory.setAttribute('aria-label', '知识标题导航');
      this.results = node('section', 'sidebar-results');
      this.results.hidden = true;
      this.results.setAttribute('aria-label', '知识库搜索结果');
      this.sidebar.append(brand, header, this.searchForm, this.directory, this.results);
      this.showDirectory = button('目录与搜索', 'reader-action', () => this.toggleSidebar());
      this.showDirectory.hidden = true;
      this.showDirectory.setAttribute('aria-controls', this.sidebar.id);
      this.currentLocation = node('span', 'current-location');
      const toolbarBack = node('a', 'back-to-plan toolbar-back', '返回计划');
      toolbarBack.href = '/';
      this.toolbar.append(this.showDirectory, this.currentLocation, toolbarBack);
      this.content.append(this.toolbar, this.document);
      this.workspace.append(this.sidebar, this.content);
      this.backdrop = button('', 'directory-backdrop', () => this.toggleSidebar());
      this.backdrop.setAttribute('aria-label', '关闭目录遮罩');
      this.workspace.append(this.backdrop);
      this.root.replaceChildren(this.workspace);
    }

    setChaptersOpen(open, { focus = false } = {}) {
      this.chapterNav.hidden = !open;
      this.chapterButton.setAttribute('aria-expanded', String(open));
      if (open) this.chapterNav.querySelector('[aria-current], a')?.focus({ preventScroll: true });
      else if (focus) this.chapterButton.focus({ preventScroll: true });
    }

    toggleSidebar({ focus = true } = {}) {
      const anchor = this.headingNodes?.find(({ item }) => item.id === this.activeId)?.heading;
      const previousTop = anchor?.getBoundingClientRect().top;
      const hidden = this.workspace.classList.toggle('directory-hidden');
      this.sidebar.hidden = hidden;
      this.showDirectory.hidden = !hidden;
      this.showDirectory.setAttribute('aria-expanded', String(!hidden));
      if (anchor && previousTop !== undefined) {
        const change = anchor.getBoundingClientRect().top - previousTop;
        if (this.compact) this.content.scrollBy({ top: change, behavior: 'instant' });
        else if (window.scrollY > 0) window.scrollBy({ top: change, behavior: 'instant' });
      }
      if (focus) (hidden ? this.showDirectory : this.directoryInput).focus({ preventScroll: true });
      this.scheduleActive();
      this.persistReading?.();
    }

    setTopics(topics) {
      this.topics = topics;
      this.headingNodes = [];
      this.entries = [];
      this.tree = [];
      this.document.replaceChildren();
      catalog.categories.forEach((category) => {
        const categoryTopics = topics.filter((topic) => topic.category === category.id);
        if (!categoryTopics.length) return;
        const categoryNode = { id: `${this.prefix}-category-${category.id}`, title: category.title, children: [], parent: null };
        this.tree.push(categoryNode);
        const categorySection = node('section', 'knowledge-category');
        if (!this.compact) this.addHeading(categorySection, categoryNode, 1);
        this.entries.push({ id: categoryNode.id, title: category.title, path: category.title,
          aliases: [], body: '', code: '' });
        categoryTopics.forEach((topic) => {
          const topicNode = { id: `${this.prefix}-topic-${topic.id}`, title: topic.title,
            aliases: topic.aliases ?? [], children: [], parent: categoryNode };
          categoryNode.children.push(topicNode);
          const article = node('article', 'knowledge-topic');
          this.addHeading(article, topicNode, 2);
          this.entries.push({ id: topicNode.id, title: topic.title,
            path: `${category.title} / ${topic.title}`, aliases: topic.aliases ?? [], body: topic.summary, code: '' });
          article.append(node('p', 'topic-summary', topic.summary));
          topic.sections.forEach((section) => {
            const sectionNode = { id: `${this.prefix}-${topic.id}-${section.id}`, title: section.title, children: [], parent: topicNode };
            topicNode.children.push(sectionNode);
            const sectionElement = node('section', 'topic-section');
            this.addHeading(sectionElement, sectionNode, 3);
            this.renderSection(sectionElement, section);
            article.append(sectionElement);
            this.entries.push({ id: sectionNode.id, title: section.title,
              path: `${category.title} / ${topic.title} / ${section.title}`, aliases: [],
              contextAliases: topic.aliases ?? [], body: sectionBody(section), code: section.code ?? '' });
          });
          const referenceNode = { id: `${this.prefix}-${topic.id}-references`, title: '关联练习与参考', children: [], parent: topicNode };
          topicNode.children.push(referenceNode);
          const references = node('section', 'topic-section topic-references');
          this.addHeading(references, referenceNode, 3);
          const links = node('div', 'practice-links');
          topic.problems.forEach((id) => {
            const problem = this.problems.get(id);
            if (!problem) return;
            const link = node('a', '', `${id}. ${problem.title} ↗`);
            link.href = problem.url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            links.append(link);
          });
          if (links.childElementCount) references.append(links);
          (topic.sources ?? []).forEach((source) => {
            const link = node('a', 'reference-link', `${source.title} ↗`);
            link.href = source.url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            references.append(link);
          });
          article.append(references);
          categorySection.append(article);
        });
        this.document.append(categorySection);
      });
      this.collapsed = new Set(this.branchIds());
      this.renderDirectory();
      if (this.compact) this.content.scrollTop = 0;
      this.pendingJump = null;
      this.scheduleActive();
    }

    addHeading(parent, item, level) {
      const heading = node(`h${level}`, 'knowledge-heading', item.title);
      heading.id = item.id;
      heading.tabIndex = -1;
      parent.append(heading);
      this.headingNodes.push({ item, heading });
    }

    renderSection(parent, section) {
      (section.paragraphs ?? []).forEach((text) => parent.append(node('p', '', text)));
      if (section.list?.length) {
        const list = node('ul', 'knowledge-list');
        section.list.forEach((text) => list.append(node('li', '', text)));
        parent.append(list);
      }
      if (section.rows?.length) {
        const wrapper = node('div', 'table-scroll');
        const methods = section.headers[0] === '方法名';
        if (methods) wrapper.classList.add('method-table');
        wrapper.tabIndex = 0;
        wrapper.setAttribute('aria-label', `${section.title} 表格`);
        const table = node('table', 'knowledge-table');
        const head = node('thead');
        const headRow = node('tr');
        section.headers.forEach((text) => {
          const cell = node('th', '', text);
          cell.scope = 'col';
          headRow.append(cell);
        });
        head.append(headRow);
        const body = node('tbody');
        section.rows.forEach((row) => {
          const line = node('tr');
          row.forEach((text, index) => {
            const cell = node('td');
            cell.append(methods && index === 0 ? node('code', 'method-name', text) : document.createTextNode(text));
            line.append(cell);
          });
          body.append(line);
        });
        table.append(head, body);
        wrapper.append(table);
        parent.append(wrapper);
      }
      if (section.code) {
        const wrapper = node('div', 'code-example');
        const bar = node('div', 'code-bar');
        let resetCopy;
        const copy = button('复制代码', 'copy-code', async () => {
          clearTimeout(resetCopy);
          try {
            await navigator.clipboard.writeText(section.code);
            copy.textContent = '已复制';
            copy.dataset.state = 'success';
          } catch {
            copy.textContent = '复制失败';
            copy.dataset.state = 'error';
          }
          resetCopy = setTimeout(() => {
            copy.textContent = '复制代码';
            delete copy.dataset.state;
          }, 2200);
        });
        copy.setAttribute('aria-label', `复制 ${section.title} 的 Java 代码`);
        copy.setAttribute('aria-live', 'polite');
        bar.append(node('span', 'code-language', 'Java'), copy);
        const pre = node('pre');
        pre.tabIndex = 0;
        pre.setAttribute('aria-label', `${section.title} 的 Java 代码`);
        pre.append(javaCode(section.code));
        wrapper.append(bar, pre);
        parent.append(wrapper);
      }
    }

    branchIds() {
      return this.tree.flatMap((category) => [category.id, ...category.children.map((topic) => topic.id)]);
    }

    closeBranch(item, collapsed) {
      if (!item.children.length) return;
      collapsed.add(item.id);
      item.children.forEach((child) => this.closeBranch(child, collapsed));
    }

    expandBranch(item, collapsed, { onlyNextLevel = false } = {}) {
      const siblings = item.parent?.children ?? this.tree;
      siblings.forEach((sibling) => {
        if (sibling !== item) this.closeBranch(sibling, collapsed);
      });
      if (onlyNextLevel) item.children.forEach((child) => this.closeBranch(child, collapsed));
      collapsed.delete(item.id);
    }

    openPath(item) {
      const path = [];
      for (let current = item; current; current = current.parent) {
        if (current.children.length) path.unshift(current);
      }
      path.forEach((branch) => this.expandBranch(branch, this.collapsed));
    }

    renderDirectory() {
      if (this.compact) {
        this.chapterNav.replaceChildren();
        this.headingNodes.filter(({ item }) => !item.children.length).forEach(({ item }) => {
          const link = node('a', 'chapter-link', item.title);
          link.href = `#${item.id}`;
          link.addEventListener('click', (event) => {
            event.preventDefault();
            this.setChaptersOpen(false);
            this.jumpTo(item.id, { focus: true, pointer: event.detail > 0 });
          });
          this.chapterNav.append(link);
        });
        this.setChaptersOpen(false);
        this.updateActive(this.activeId);
        return;
      }
      const collapsed = this.collapsed;
      const feedbackId = this.feedbackId;
      this.feedbackId = null;
      this.directoryRows = new Map();
      const renderItem = (item, level) => {
        const li = node('li', `directory-item level-${level}`);
        const row = node('div', 'directory-row');
        if (item.children.length && !collapsed.has(item.id)) row.classList.add('is-expanded');
        if (item.id === feedbackId) row.classList.add('was-pressed');
        let link;
        if (item.children.length) {
          link = button(item.title, 'directory-link directory-parent', () => {
            if (collapsed.has(item.id)) this.expandBranch(item, collapsed, { onlyNextLevel: true });
            else this.closeBranch(item, collapsed);
            this.feedbackId = item.id;
            this.renderDirectory();
            this.directoryRows.get(item.id).row.querySelector('button').focus({ preventScroll: true });
            this.persistReading?.();
          });
          link.setAttribute('aria-expanded', String(!collapsed.has(item.id)));
          link.setAttribute('aria-controls', `${item.id}-children`);
        } else {
          link = node('a', 'directory-link', item.title);
          link.href = `#${item.id}`;
          link.addEventListener('click', (event) => {
            event.preventDefault();
            this.jumpTo(item.id, { focus: true, pointer: event.detail > 0 });
            if (window.matchMedia('(max-width: 720px)').matches && !this.sidebar.hidden) {
              this.toggleSidebar();
              this.headingNodes.find(({ item: headingItem }) => headingItem.id === item.id)?.heading.focus({ preventScroll: true });
            }
          });
        }
        row.append(link);
        li.append(row);
        if (item.children.length) {
          const children = node('ul');
          children.id = `${item.id}-children`;
          children.hidden = collapsed.has(item.id);
          item.children.forEach((child) => children.append(renderItem(child, level + 1)));
          li.append(children);
        }
        this.directoryRows.set(item.id, { row, link, li, item });
        return li;
      };
      const list = node('ul', 'directory-tree');
      this.tree.forEach((item) => list.append(renderItem(item, 1)));
      this.directory.replaceChildren(list);
      this.updateActive(this.activeId);
    }

    jumpFromHash() {
      let id;
      try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
      if (id) {
        this.jumpTo(id);
      }
    }

    jumpTo(id, { focus = false, fromSearch = false, pointer = false } = {}) {
      const entry = this.headingNodes.find(({ item }) => item.id === id);
      if (!entry) return;
      if (!this.compact) {
        if (!fromSearch) {
          if (this.query) this.search('');
          this.openPath(entry.item);
          this.renderDirectory();
        }
      }
      this.pendingJump = { id, until: performance.now() + 1000 };
      this.updateActive(id);
      if (!this.compact) history.replaceState(null, '', `#${id}`);
      if (focus) {
        entry.heading.classList.toggle('pointer-target', pointer);
        entry.heading.focus({ preventScroll: true });
      }
      const offset = this.compact ? 18 : this.toolbar.getBoundingClientRect().bottom + 18;
      const top = entry.heading.getBoundingClientRect().top;
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (this.compact) {
        this.content.scrollTo({ top: this.content.scrollTop + top - this.content.getBoundingClientRect().top - offset, behavior: reduced ? 'instant' : 'smooth' });
      } else window.scrollTo({ top: window.scrollY + top - offset, behavior: reduced ? 'instant' : 'smooth' });
      setTimeout(() => { this.pendingJump = null; this.scheduleActive(); }, 1050);
    }

    scheduleActive() {
      if (this.frame !== null) return;
      this.frame = requestAnimationFrame(() => {
        this.frame = null;
        if (this.pendingJump && performance.now() < this.pendingJump.until) return;
        const line = this.compact ? this.content.getBoundingClientRect().top + 26 : this.toolbar.getBoundingClientRect().bottom + 26;
        let current = this.headingNodes[0]?.item.id;
        for (const { item, heading } of this.headingNodes) {
          if (heading.getBoundingClientRect().top <= line) current = item.id;
          else break;
        }
        const bottom = this.compact
          ? this.content.scrollTop + this.content.clientHeight >= this.content.scrollHeight - 3
          : window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 3;
        if (bottom && this.headingNodes.length) current = this.headingNodes.at(-1).item.id;
        this.updateActive(current);
        this.persistReading?.();
      });
    }

    updateActive(id) {
      const changed = this.activeId !== id;
      this.activeId = id;
      this.searchResultRows?.forEach((link, resultId) => {
        link.classList.toggle('is-current', resultId === id);
        if (resultId === id) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
      if (this.compact) {
        this.chapterNav.querySelectorAll('a').forEach((link) => {
          if (link.getAttribute('href') === `#${id}`) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        });
        return;
      }
      this.directoryRows?.forEach(({ row, link }) => {
        row.classList.remove('is-active', 'contains-active');
        link.removeAttribute('aria-current');
      });
      let navigationItem = this.directoryRows?.get(id)?.item;
      while (navigationItem?.children.length) navigationItem = navigationItem.children[0];
      const selected = this.directoryRows?.get(navigationItem?.id);
      if (!selected) return;
      this.currentLocation.textContent = selected.item.parent
        ? `${selected.item.parent.title} / ${selected.item.title}` : selected.item.title;
      for (let item = selected.item; item; item = item.parent) {
        const result = this.directoryRows.get(item.id);
        if (result.li.getClientRects().length && !this.sidebar.hidden) {
          result.row.classList.add(item.id === selected.item.id ? 'is-active' : 'contains-active');
          if (item.id === selected.item.id) result.link.setAttribute('aria-current', 'location');
          if (changed && !this.query) {
            const rowBounds = result.row.getBoundingClientRect();
            const directoryBounds = this.directory.getBoundingClientRect();
            if (rowBounds.top < directoryBounds.top) this.directory.scrollTop += rowBounds.top - directoryBounds.top - 8;
            else if (rowBounds.bottom > directoryBounds.bottom) this.directory.scrollTop += rowBounds.bottom - directoryBounds.bottom + 8;
          }
          break;
        }
      }
    }

    search(value) {
      clearTimeout(this.searchTimer);
      this.directoryInput.value = value.slice(0, 160);
      this.query = this.directoryInput.value.trim();
      const terms = termsFor(this.query);
      this.results.replaceChildren();
      this.searchResultRows = new Map();
      this.results.hidden = !terms.length;
      this.directory.hidden = Boolean(terms.length);
      this.clearSearch.hidden = !terms.length;
      this.directoryLabel.textContent = terms.length ? '知识库搜索' : '阅读目录';
      if (!terms.length) {
        this.renderDirectory();
        return;
      }
      const scored = this.entries.map((entry, order) => {
        const title = [entry.title, ...entry.aliases].join(' ');
        const content = `${title}\n${entry.body}\n${entry.code}`;
        const allText = `${entry.path}\n${(entry.contextAliases ?? []).join(' ')}\n${content}`;
        if (!matches(allText, terms)) return null;
        // Context scopes a query, but does not create duplicate hits for every child.
        if (!terms.some((term) => matches(content, [term]))) return null;
        const titleHit = terms.some((term) => matches(title, [term]));
        const bodyHit = terms.some((term) => matches(entry.body, [term]));
        const codeHit = terms.some((term) => matches(entry.code, [term]));
        return { entry, order, titleHit, bodyHit, codeHit };
      }).filter(Boolean).sort((a, b) => Number(b.titleHit) - Number(a.titleHit) || a.order - b.order);
      const caption = node('p', 'results-caption');
      caption.append(node('span', '', '搜索结果'), node('span', '', `${scored.length} 项`));
      caption.setAttribute('role', 'status');
      this.results.append(caption);
      if (!scored.length) this.results.append(node('p', 'search-empty', '无结果'));
      scored.forEach(({ entry, titleHit, bodyHit, codeHit }) => {
        const result = node('a', 'search-result sidebar-result');
        result.href = `#${entry.id}`;
        result.addEventListener('click', (event) => {
          event.preventDefault();
          this.jumpTo(entry.id, { focus: true, fromSearch: true, pointer: event.detail > 0 });
          if (window.matchMedia('(max-width: 720px)').matches && !this.sidebar.hidden) {
            this.toggleSidebar({ focus: false });
            this.headingNodes.find(({ item }) => item.id === entry.id)?.heading.focus({ preventScroll: true });
          }
        });
        const title = node('span', 'result-title');
        highlight(title, entry.title, terms);
        const path = node('span', 'result-path', entry.path.split(' / ').slice(0, -1).join(' / '));
        const sources = [[titleHit, '标题'], [bodyHit, '正文'], [codeHit, '代码']]
          .filter(([hit]) => hit).map(([, label]) => label).join('、');
        const source = node('span', 'result-source', `${sources}命中`);
        const useCode = codeHit && !bodyHit;
        const text = (useCode ? entry.code : entry.body || entry.code).replace(/\s+/gu, ' ');
        const first = terms.map((term) => normalize(text).indexOf(term)).filter((position) => position >= 0).sort((a, b) => a - b)[0] ?? 0;
        const start = Math.max(0, first - 30);
        const excerpt = `${start ? '…' : ''}${text.slice(start, start + 115)}${text.length > start + 115 ? '…' : ''}`;
        const snippet = node(useCode ? 'code' : 'span', useCode ? 'result-code' : 'result-snippet');
        highlight(snippet, excerpt, terms);
        result.append(title);
        if (path.textContent) result.append(path);
        result.append(source);
        if (text) result.append(snippet);
        this.results.append(result);
        this.searchResultRows.set(entry.id, result);
      });
      this.updateActive(this.activeId);
    }

    captureReading() {
      const line = this.toolbar.getBoundingClientRect().bottom;
      let entry = this.headingNodes[0];
      for (const candidate of this.headingNodes) {
        if (candidate.heading.getBoundingClientRect().top <= line + 26) entry = candidate;
        else break;
      }
      return { atTop: window.scrollY < 1, anchor: entry?.item.id,
        offset: entry ? entry.heading.getBoundingClientRect().top - line : 0 };
    }

    restorePosition(reading) {
      const heading = this.headingNodes.find(({ item }) => item.id === reading.anchor)?.heading;
      if (reading.atTop || !heading) window.scrollTo({ top: 0, behavior: 'instant' });
      else {
        const offset = Number.isFinite(reading.offset) ? reading.offset : 18;
        window.scrollTo({ top: window.scrollY + heading.getBoundingClientRect().top
          - this.toolbar.getBoundingClientRect().bottom - offset, behavior: 'instant' });
      }
      this.scheduleActive();
    }

    restoreReading(saved) {
      clearTimeout(this.searchTimer);
      this.pendingJump = null;
      this.query = '';
      this.directoryInput.value = '';
      this.results.hidden = true;
      this.results.replaceChildren();
      this.searchResultRows = new Map();
      this.directory.hidden = false;
      this.clearSearch.hidden = true;
      this.directoryLabel.textContent = '阅读目录';
      const branches = this.branchIds();
      this.collapsed = new Set(Array.isArray(saved?.collapsed)
        ? saved.collapsed.filter((id) => branches.includes(id))
        : branches);
      const preferred = new Set();
      for (let item = this.headingNodes.find(({ item }) => item.id === saved?.reading?.anchor)?.item; item; item = item.parent) {
        preferred.add(item.id);
      }
      const normalizeBranches = (siblings) => {
        const expanded = siblings.filter((item) => item.children.length && !this.collapsed.has(item.id));
        const keep = expanded.find((item) => preferred.has(item.id)) ?? expanded[0];
        siblings.forEach((item) => {
          if (item !== keep) this.closeBranch(item, this.collapsed);
          else normalizeBranches(item.children);
        });
      };
      normalizeBranches(this.tree);
      const hidden = typeof saved?.hidden === 'boolean' ? saved.hidden : window.matchMedia('(max-width: 720px)').matches;
      this.workspace.classList.toggle('directory-hidden', hidden);
      this.sidebar.hidden = hidden;
      this.showDirectory.hidden = !hidden;
      this.showDirectory.setAttribute('aria-expanded', String(!hidden));
      this.renderDirectory();
      this.restorePosition(saved?.reading ?? { atTop: true });
    }

    destroy() {
      this.abort.abort();
      clearTimeout(this.searchTimer);
      if (this.frame !== null) cancelAnimationFrame(this.frame);
    }
  }

  const allProblems = (stages) => stages.flatMap((stage) => stage.days.flatMap((day) => day.questions));
  let dialog;
  let relatedReader;

  function openRelated(question, stages) {
    if (!dialog) {
      dialog = node('dialog', 'knowledge-dialog');
      dialog.setAttribute('aria-labelledby', 'related-title');
      dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
      dialog.addEventListener('close', () => {
        document.body.classList.remove('knowledge-dialog-open');
        relatedReader?.destroy();
        relatedReader = null;
      });
      document.body.append(dialog);
    }
    relatedReader?.destroy();
    const topics = catalog.topics.filter((topic) => topic.problems.includes(question.id));
    const panel = node('div', 'related-panel');
    const header = node('header', 'related-header');
    const title = node('h2', '', `${question.id}. ${question.title}`);
    title.id = 'related-title';
    const close = button('×', 'related-close', () => dialog.close());
    close.setAttribute('aria-label', '关闭相关知识');
    const picker = node('div', 'related-picker');
    const tabs = node('div', 'related-tabs');
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', '关联知识点');
    const readerRoot = node('div', 'related-reader-root');
    const fullLink = node('a', 'related-full-link', '完整知识库 ↗');
    fullLink.target = '_blank';
    fullLink.rel = 'noopener noreferrer';
    fullLink.href = '/knowledge';
    const choose = (topic) => {
      tabs.querySelectorAll('button').forEach((item) => {
        const selected = item.dataset.topic === topic.id;
        item.setAttribute('aria-selected', String(selected));
        item.tabIndex = selected ? 0 : -1;
      });
      relatedReader.setTopics([topic]);
      relatedReader.content.setAttribute('aria-labelledby', `related-tab-${topic.id}`);
      fullLink.href = `/knowledge#kb-topic-${topic.id}`;
    };
    topics.forEach((topic) => {
      const choice = button(topic.title, 'related-topic-choice', () => choose(topic));
      choice.dataset.topic = topic.id;
      choice.id = `related-tab-${topic.id}`;
      choice.setAttribute('role', 'tab');
      choice.setAttribute('aria-controls', 'related-article');
      choice.setAttribute('aria-selected', 'false');
      choice.addEventListener('keydown', (event) => {
        const choices = [...tabs.querySelectorAll('button')];
        const index = choices.indexOf(choice);
        const next = event.key === 'ArrowRight' ? (index + 1) % choices.length
          : event.key === 'ArrowLeft' ? (index + choices.length - 1) % choices.length
            : event.key === 'Home' ? 0 : event.key === 'End' ? choices.length - 1 : -1;
        if (next !== -1) { event.preventDefault(); choices[next].click(); choices[next].focus(); }
      });
      tabs.append(choice);
    });
    const actions = node('div', 'related-actions');
    actions.append(fullLink, close);
    header.append(title, actions);
    picker.append(tabs);
    panel.append(header, picker, readerRoot);
    dialog.replaceChildren(panel);
    if (topics.length) {
      relatedReader = new Reader(readerRoot, { topics: [topics[0]], compact: true, problems: allProblems(stages) });
      relatedReader.content.id = 'related-article';
      relatedReader.content.setAttribute('role', 'tabpanel');
      picker.append(relatedReader.toolbar);
      choose(topics[0]);
    } else readerRoot.append(node('p', 'search-empty', '暂无关联知识'));
    document.body.classList.add('knowledge-dialog-open');
    dialog.showModal();
    relatedReader?.scheduleActive();
    close.focus();
  }

  window.Hot100KnowledgeUI = { openRelated };

  async function initializeKnowledge() {
    const root = document.getElementById('knowledge-reader');
    if (!root) return;
    root.setAttribute('aria-busy', 'true');
    let problems = [];
    let planFailed = false;
    let runtimeId = null;
    const sessionRequest = fetch('/api/session').then(async (response) => {
      if (response.ok) {
        const session = await response.json();
        if (typeof session.id === 'string') runtimeId = session.id;
      }
    }).catch(() => {});
    try {
      const response = await fetch('/api/plan');
      if (!response.ok) throw new Error('Plan unavailable');
      problems = allProblems((await response.json()).stages);
    } catch { planFailed = true; }
    await sessionRequest;
    history.scrollRestoration = 'manual';
    const reader = new Reader(root, { problems });
    if (planFailed) reader.document.prepend(node('p', 'knowledge-warning', '关联练习加载失败'));
    let storageTimer;
    const readSaved = () => {
      try {
        const saved = JSON.parse(localStorage.getItem(readingKey));
        return saved?.runtimeId === runtimeId && runtimeId ? saved : null;
      } catch { return null; }
    };
    const saveReading = () => {
      if (!runtimeId) return;
      const saved = { runtimeId, collapsed: [...reader.collapsed], hidden: reader.sidebar.hidden,
        reading: reader.captureReading() };
      try { localStorage.setItem(readingKey, JSON.stringify(saved)); } catch { /* Storage may be disabled. */ }
    };
    const resumeReading = async ({ initial = false } = {}) => {
      clearTimeout(reader.searchTimer);
      reader.pendingJump = null;
      const saved = readSaved();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      reader.restoreReading(saved);
      const navigation = performance.getEntriesByType('navigation')[0]?.type;
      if (initial && location.hash && navigation !== 'reload' && navigation !== 'back_forward') reader.jumpFromHash();
      else if (location.hash) history.replaceState(null, '', location.pathname);
      reader.persistReading = () => {
        clearTimeout(storageTimer);
        storageTimer = setTimeout(saveReading, 120);
      };
      reader.persistReading();
    };
    await resumeReading({ initial: true });
    root.setAttribute('aria-busy', 'false');
    window.addEventListener('pagehide', () => { clearTimeout(storageTimer); saveReading(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) saveReading(); });
    window.addEventListener('pageshow', async (event) => {
      if (!event.persisted) return;
      root.setAttribute('aria-busy', 'true');
      try {
        const response = await fetch('/api/session');
        if (response.ok) runtimeId = (await response.json()).id;
        else runtimeId = null;
      } catch { runtimeId = null; }
      await resumeReading();
      root.setAttribute('aria-busy', 'false');
    });
  }

  initializeKnowledge();
})();
