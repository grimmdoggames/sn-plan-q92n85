/* Контент-план Salestina Nails — страница для телефона и компьютера.
   Данные: data/plan.json. Отметки «опубликовано»: см. config.js. */
(() => {
  'use strict';

  const CFG = Object.assign({ statusStorage: 'local', appsScriptUrl: '', refreshSeconds: 60 }, window.CP_CONFIG || {});
  const $ = (s, el = document) => el.querySelector(s);
  const main = $('#main');

  let plan = null;
  let items = [];
  let status = {};          // id → { done: true/false, at: ISO }
  let view = null;
  let openIds = null;       // открытые в поп-апе записи

  // ---------- мелочи ----------
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const MONTHS_N = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  const DOWS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  const DOWS_FULL = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
  const d = (iso) => new Date(iso + 'T12:00:00');
  const isoOf = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  const today = isoOf(new Date());
  const fmtShort = (iso) => { const x = d(iso); return `${DOWS[x.getDay()]}, ${x.getDate()} ${MONTHS[x.getMonth()]}`; };
  const fmtLong = (iso) => { const x = d(iso); return `${x.getDate()} ${MONTHS[x.getMonth()]}, ${DOWS_FULL[x.getDay()]}`; };
  const isDone = (id) => !!(status[id] && status[id].done);

  const ICON = {
    reel: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="1.5" width="11" height="13" fill="none" stroke="currentColor"/><path d="M6.5 5.5v5l4-2.5z" fill="currentColor"/></svg>',
    work: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="2.5" width="13" height="11" fill="none" stroke="currentColor"/><circle cx="8" cy="8" r="2.6" fill="none" stroke="currentColor"/></svg>',
    story: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor"/><circle cx="8" cy="8" r="3.5" fill="none" stroke="currentColor" stroke-dasharray="2 1.5"/></svg>',
    tick: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    star: '<svg class="ny-mark" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1v14M1 8h14M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width=".9"/></svg>',
    share: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5v9M4.5 5L8 1.5 11.5 5M3 8.5v6h10v-6" fill="none" stroke="currentColor"/></svg>',
    copy: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="4.5" y="4.5" width="9" height="10" fill="none" stroke="currentColor"/><path d="M2.5 11.5v-10h8" fill="none" stroke="currentColor"/></svg>',
    down: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5v9M4.5 7L8 10.5 11.5 7M2.5 14.5h11" fill="none" stroke="currentColor"/></svg>',
    carousel: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="3.5" width="10" height="10" fill="none" stroke="currentColor"/><path d="M4.5 1.5h10v10" fill="none" stroke="currentColor"/></svg>',
    due: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor"/><path d="M8 4.2V8l2.6 1.8" fill="none" stroke="currentColor"/></svg>',
    chev: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 6l5 5 5-5" fill="none" stroke="currentColor"/></svg>',
  };
  const KIND = { reel: ['рилс', 'рилс'], work: ['фото работы', 'фото'], carousel: ['карусель', 'карусель'], story: ['сторис', 'сторис'] };
  const kindName = (it, short) => (KIND[it.kind] || KIND.work)[short ? 1 : 0];
  const kindLabel = (it) => `<span class="kind">${ICON[it.kind] || ICON.work}${kindName(it)}</span>`;
  const inFeed = (it) => it.kind !== 'story'; // сторис в ленту не идут и в счётчик не входят
  // серия из плана: обучающий / располагающий / праздничный («работа» не пишем — это и так видно по типу)
  const seriesLabel = (it) => (it.series && it.series !== 'работа' ? `<span class="series s-${esc(it.series)}">${esc(it.series)}</span>` : '');
  // «Утвердить до» — срок Кристины: «текст 18.11 · графика 21.11»; в клетке месяца — только первая дата
  const isReady = (it) => /^готов/i.test(it.due || '');
  const dueShort = (it) => { if (!it.due) return ''; if (isReady(it)) return 'готов'; const m = it.due.match(/\d{1,2}\.\d{2}/); return m ? 'до ' + m[0] : ''; };
  const dueRow = (it) => (it.due ? `<span class="due${isReady(it) ? ' is-ready' : ''}">${ICON.due}${isReady(it) ? 'готов' : 'утвердить: ' + esc(it.due)}</span>` : '');
  // заглушка вместо обложки: заголовок на тёмном фоне
  const placeholder = (it, cls) => `<span class="ph ph-${esc(it.kind)} ${cls || ''}" aria-hidden="true"><span class="ph-brand">SALESTINA NAILS</span>
    <span class="ph-title">${esc(it.short || it.title)}</span><span class="ph-note">${it.kind === 'story' ? 'сторис готовится' : 'обложка готовится'}</span></span>`;

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { t.hidden = true; }, 2600);
  }

  // ---------- хранение отметок ----------
  const LS_KEY = 'sn-content-plan-status-v1';
  const local = {
    load() { try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; } },
    save(all) { try { localStorage.setItem(LS_KEY, JSON.stringify(all)); } catch { /* приватный режим */ } },
  };

  const shared = CFG.statusStorage === 'apps-script' && CFG.appsScriptUrl;
  const store = {
    async load() {
      if (!shared) return local.load();
      const r = await fetch(CFG.appsScriptUrl + '?action=list&t=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const data = await r.json();
      local.save(data.status || {});
      return data.status || {};
    },
    async set(id, done) {
      status[id] = { done, at: new Date().toISOString() };
      local.save(status);
      if (!shared) return;
      // text/plain — чтобы браузер не делал лишний «предварительный» запрос
      await fetch(CFG.appsScriptUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'set', id, done }) });
    },
  };

  function setSync(text) { $('#sync').textContent = text; }

  async function refreshStatus(quiet) {
    try {
      status = await store.load();
      setSync(shared ? 'Отметки общие: видны на всех телефонах и компьютерах.' : 'Отметки пока сохраняются только в этом браузере.');
    } catch (e) {
      status = local.load();
      if (!quiet) setSync('Нет связи с общим хранилищем — показываю отметки этого устройства.');
    }
    render();
  }

  async function toggle(id) {
    const next = !isDone(id);
    try {
      const p = store.set(id, next);
      render();
      await p;
      toast(next ? 'Отмечено: опубликовано' : 'Отметка снята');
    } catch {
      toast('Не удалось сохранить в общем хранилище. Попробуйте ещё раз.');
    }
  }

  // ---------- вид: список по неделям ----------
  function rowHtml(it) {
    const cls = ['row', it.kind];
    if (isDone(it.id)) cls.push('is-done');
    if (it.date === today) cls.push('is-today');
    if (it.date && it.date < today) cls.push('is-past');
    if (it.newyear) cls.push('is-ny');
    const when = it.date ? `<b>${esc(fmtShort(it.date))}</b>${it.time ? ' · ' + esc(it.time) : ''}` : '<b>без даты</b>';
    return `<div class="${cls.join(' ')}" data-id="${esc(it.id)}">
      <button type="button" class="row-open" data-open="${esc(it.id)}">
        ${it.thumb || it.image ? `<img class="thumb" src="${esc(it.thumb || it.image)}" alt="" loading="lazy" width="60" height="80">` : placeholder(it, 'thumb')}
        <span class="row-text">
          <span class="row-date">${when}</span>
          <span class="row-title">${esc(it.title)}</span>
          <span class="row-meta">${kindLabel(it)}${seriesLabel(it)}${it.newyear ? `<span class="kind">${ICON.star}новогодний</span>` : ''}</span>
          ${dueRow(it)}
        </span>
      </button>
      <button type="button" class="mark" data-toggle="${esc(it.id)}" aria-pressed="${isDone(it.id)}"
        aria-label="${isDone(it.id) ? 'Опубликовано. Снять отметку' : 'Отметить опубликованным'}"><i>${ICON.tick}</i></button>
    </div>`;
  }

  function weekStart(iso) { // неделя плана: со вторника по понедельник
    const x = d(iso); const shift = (x.getDay() + 5) % 7; x.setDate(x.getDate() - shift); return isoOf(x);
  }

  function renderList() {
    const dated = items.filter((i) => i.date);
    const weeks = new Map();
    for (const it of dated) {
      const k = weekStart(it.date);
      if (!weeks.has(k)) weeks.set(k, []);
      weeks.get(k).push(it);
    }
    let n = 0; let html = '';
    for (const [k, list] of [...weeks.entries()].sort()) {
      n += 1;
      const end = d(k); end.setDate(end.getDate() + 6);
      const a = d(k);
      const range = a.getMonth() === end.getMonth()
        ? `${a.getDate()}–${end.getDate()} ${MONTHS[a.getMonth()]}`
        : `${a.getDate()} ${MONTHS[a.getMonth()]} – ${end.getDate()} ${MONTHS[end.getMonth()]}`;
      const wk = list[0].week || n;
      html += `<section class="week"><div class="week-h"><h2>Неделя ${esc(wk)}</h2><span>${esc(range)}</span></div>${list.map(rowHtml).join('')}</section>`;
    }
    html += readyHtml();
    main.innerHTML = html;
  }

  function readyHtml() {
    const undated = items.filter((i) => !i.date);
    if (!undated.length) return '';
    return `<div class="section-h"><h2>Готовые ролики</h2><p>дата в плане пока не назначена</p></div>
      <section class="week">${undated.map(rowHtml).join('')}</section>`;
  }

  // ---------- вид: месяц ----------
  function renderMonth() {
    const byDate = new Map();
    for (const it of items) if (it.date) (byDate.get(it.date) || byDate.set(it.date, []).get(it.date)).push(it);
    const from = d(plan.range?.from || items.find((i) => i.date).date);
    const to = d(plan.range?.to || items.filter((i) => i.date).at(-1).date);
    const nyFrom = plan.newyear?.from; const nyTo = plan.newyear?.to;
    let html = '';
    for (let m = new Date(from.getFullYear(), from.getMonth(), 1); m <= to; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
      // прошлые недели до начала плана не показываем: начинаем с понедельника недели старта
      let firstDay = 1;
      if (m.getFullYear() === from.getFullYear() && m.getMonth() === from.getMonth()) {
        firstDay = Math.max(1, from.getDate() - ((from.getDay() + 6) % 7));
      }
      const first = new Date(m.getFullYear(), m.getMonth(), firstDay); const lead = (first.getDay() + 6) % 7; // с понедельника
      const days = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
      let cells = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'].map((w) => `<div class="dow">${w}</div>`).join('');
      for (let i = 0; i < lead; i += 1) cells += '<div class="day out"></div>';
      for (let day = firstDay; day <= days; day += 1) {
        const iso = isoOf(new Date(m.getFullYear(), m.getMonth(), day));
        const list = byDate.get(iso) || [];
        const ny = list.some((i) => i.newyear) || (!list.length && nyFrom && iso >= nyFrom && iso <= nyTo);
        const cls = ['day'];
        if (list.length) cls.push('has');
        if (iso === today) cls.push('today');
        if (ny) cls.push('is-ny');
        if (list.length && list.every((i) => isDone(i.id))) cls.push('is-done');
        const it = list[0];
        const inner = it ? `
          <span class="day-thumb">${it.thumb || it.image ? `<img src="${esc(it.thumb || it.image)}" alt="" loading="lazy">` : placeholder(it, 'mini')}${isDone(it.id) ? `<span class="tick">${ICON.tick}</span>` : ''}</span>
          <span class="t">${kindName(it, true)}${list.length > 1 ? ' +' + (list.length - 1) : ''}</span>
          <span class="day-title">${esc(it.short || it.title)}</span>
          ${dueShort(it) ? `<span class="day-due${isReady(it) ? ' is-ready' : ''}">${esc(dueShort(it))}</span>` : ''}` : '';
        const label = it ? `${fmtLong(iso)}: ${list.map((i) => kindName(i) + ' «' + i.title + '»' + (isDone(i.id) ? ', опубликовано' : '')).join('; ')}` : '';
        cells += it
          ? `<button type="button" class="${cls.join(' ')}" data-day="${iso}" aria-label="${esc(label)}"><span class="n">${day}</span>${ny ? ICON.star : ''}${inner}</button>`
          : `<div class="${cls.join(' ')}"><span class="n">${day}</span>${ny ? ICON.star : ''}</div>`;
      }
      html += `<section class="month"><h2>${MONTHS_N[m.getMonth()]} <em>${m.getFullYear()}</em></h2><div class="grid">${cells}</div></section>`;
    }
    html += `<div class="legend"><span>${ICON.reel.replace('<svg', '<svg width="13" height="13" style="color:var(--gold)"')} рилс</span>
      <span>${ICON.work.replace('<svg', '<svg width="13" height="13" style="color:var(--gold)"')} фото работы</span>
      <span>${ICON.carousel.replace('<svg', '<svg width="13" height="13" style="color:var(--gold)"')} карусель</span>
      <span><b class="day-due">до 18.11</b> утвердить до</span>
      <span>${ICON.story.replace('<svg', '<svg width="13" height="13" style="color:var(--gold)"')} сторис (не в ленте)</span>
      <span><i></i> новогоднее оформление</span></div>`;
    html += readyHtml();
    main.innerHTML = html;
  }

  // ---------- общий рендер ----------
  function render() {
    if (!plan) return;
    const dated = items.filter((i) => i.date && inFeed(i));
    const done = dated.filter((i) => isDone(i.id)).length;
    $('#progress').innerHTML = `Опубликовано <b>${done}</b> из <b>${dated.length}</b>`;
    document.querySelectorAll('.switch button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
    const y = window.scrollY;
    if (view === 'month') renderMonth(); else renderList();
    window.scrollTo(0, y);
    if (openIds) renderSheet(openIds, true);
  }

  // ---------- поп-ап ----------
  function postHtml(it) {
    const c = it.card || {};
    const done = isDone(it.id);
    const when = it.date ? `${fmtLong(it.date)}${it.time ? ' · ' + it.time : ''}` : 'Дата не назначена';
    const capText = it.caption ? it.caption : '';
    const rows = c.fields || [];
    const idea = (rows.find(([k]) => /^Идея подписи/.test(k)) || [])[1];
    const cardHtml = rows.filter(([, v]) => v).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');
    const notes = [it.imageNote, it.note, it.video].filter(Boolean).map((n) => `<p class="note">${esc(n)}</p>`).join('');
    return `<article class="post" data-id="${esc(it.id)}">
      <figure class="post-figure">${it.image ? `<img src="${esc(it.image)}" alt="Обложка: ${esc(it.title)}">` : placeholder(it, 'big')}</figure>
      <header class="post-head">
        <p class="post-date">${esc(when)}</p>
        <p class="post-tags">${kindLabel(it)}${seriesLabel(it)}${it.newyear ? `<span class="kind">${ICON.star}новогодний</span>` : ''}</p>
        <h2 class="post-title" id="${openIds && openIds[0] === it.id ? 'sheet-title' : ''}">${esc(it.title)}</h2>
        ${it.due ? `<p class="post-due${isReady(it) ? ' is-ready' : ''}">${ICON.due}<span>${isReady(it) ? 'Готов — утверждать не нужно' : `<b>Утвердить до:</b> ${esc(it.due)}`}</span></p>` : ''}
      </header>
      <div>
        <button type="button" class="status-btn ${done ? 'is-done' : ''}" data-toggle="${esc(it.id)}" aria-pressed="${done}">
          <span class="mark"><i>${ICON.tick}</i></span>
          <span>${done ? 'Опубликовано' : 'Не опубликовано'}<small>${done ? 'нажмите, чтобы снять отметку' : 'нажмите, когда выложите'}</small></span>
        </button>
        <div class="actions">
          <button type="button" class="btn primary" data-share="${esc(it.id)}">${ICON.share}Поделиться</button>
          <button type="button" class="btn" data-copy="${esc(it.id)}">${ICON.copy}Текст</button>
          ${it.image ? `<a class="btn" href="${esc(it.image)}" download="${esc(fileName(it))}">${ICON.down}Картинка</a>` : '<span class="btn is-off" aria-disabled="true">Нет картинки</span>'}
        </div>
        <p class="label">${it.kind === 'reel' ? 'Подпись к рилсу' : it.kind === 'story' ? 'Текст сторис' : it.kind === 'carousel' ? 'Текст карусели' : 'Текст поста'}</p>
        ${capText ? `<p class="caption">${esc(capText)}</p>` : `<p class="caption pending">${esc(it.captionStatus || 'текст готовится')}</p>`}
        ${!capText && idea ? `<p class="idea">${esc(idea)}</p>` : ''}
        ${notes}
        ${cardHtml ? `<button type="button" class="more-btn" data-more aria-expanded="false">Подробнее${ICON.chev}</button>
          <dl class="card" hidden>${cardHtml}</dl>` : ''}
      </div>
    </article>`;
  }

  function renderSheet(ids, keepScroll) {
    const panel = $('.sheet-panel');
    const body = $('#sheet-body');
    const y = panel.scrollTop;
    const opened = new Set([...body.querySelectorAll('.card:not([hidden])')].map((c) => c.closest('.post').dataset.id));
    body.innerHTML = ids.map((id) => items.find((i) => i.id === id)).filter(Boolean).map(postHtml).join('');
    opened.forEach((id) => { const p = body.querySelector(`.post[data-id="${CSS.escape(id)}"]`); if (p) expand(p, true); });
    if (keepScroll) panel.scrollTop = y;
  }

  let lastFocus = null;
  // ---------- листание: по порядку календаря, сторис тоже ----------
  const navList = () => items.filter((i) => i.date);
  function navTarget(step) {
    if (!openIds) return null;
    const list = navList();
    const idx = openIds.map((id) => list.findIndex((i) => i.id === id)).filter((i) => i >= 0);
    if (!idx.length) return null;
    const j = step > 0 ? Math.max(...idx) + 1 : Math.min(...idx) - 1;
    return list[j] || null;
  }
  function updateNav() {
    const list = navList();
    const prev = navTarget(-1); const next = navTarget(1);
    const p = $('.nav-prev'); const n = $('.nav-next');
    p.disabled = !prev; n.disabled = !next;
    p.setAttribute('aria-label', prev ? `Предыдущая: ${fmtShort(prev.date)}, ${prev.title}` : 'Это первая публикация');
    n.setAttribute('aria-label', next ? `Следующая: ${fmtShort(next.date)}, ${next.title}` : 'Это последняя публикация');
    const pos = list.findIndex((i) => i.id === openIds[0]);
    $('#nav-count').textContent = pos >= 0 ? `${pos + 1} из ${list.length}` : '';
  }
  function navigate(step) {
    const t = navTarget(step);
    if (!t) return;
    openSheet([t.id], true);
  }

  function openSheet(ids, keepFocus) {
    openIds = ids;
    if (!keepFocus) lastFocus = document.activeElement;
    renderSheet(ids);
    updateNav();
    ids.forEach((id) => prepareFile(items.find((i) => i.id === id)));
    $('#sheet').hidden = false;
    document.body.style.overflow = 'hidden';
    $('.sheet-panel').scrollTop = 0;
    if (!keepFocus) $('.sheet-close').focus();
  }
  function closeSheet() {
    $('#sheet').hidden = true; openIds = null;
    document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  }
  function expand(post, on) {
    const btn = post.querySelector('[data-more]'); const card = post.querySelector('.card');
    if (!btn) return;
    btn.setAttribute('aria-expanded', String(on)); card.hidden = !on;
  }

  // ---------- кнопки ----------
  const fileName = (it) => `salestina-${it.date || 'gotovo'}-${it.id}.${(it.image || '').split('.').pop() || 'jpg'}`;
  const shareText = (it) => it.caption || it.title;

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch { /* запасной путь ниже */ }
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove(); return ok;
  }

  const files = new Map();
  async function prepareFile(it) {
    if (!it || !it.image) return null;
    if (files.has(it.id)) return files.get(it.id);
    try {
      const blob = await (await fetch(it.image)).blob();
      const file = new File([blob], fileName(it), { type: blob.type || 'image/jpeg' });
      files.set(it.id, file);
      return file;
    } catch { return null; }
  }

  async function share(it) {
    const text = shareText(it);
    // Файл готовим заранее (при открытии поп-апа): iPhone разрешает «Поделиться»
    // только сразу после нажатия, без долгого ожидания загрузки.
    try {
      let file = files.get(it.id);
      if (!file) file = await prepareFile(it);
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text, title: it.title });
        return;
      }
      if (navigator.share) { // картинку это устройство не отправляет — уйдёт только текст
        copyText(text);
        await navigator.share({ text, title: it.title });
        if (it.image) toast('Картинку скачайте кнопкой «Картинка»');
        return;
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return; // человек закрыл меню
      if (e && e.name === 'NotAllowedError') { toast('Нажмите «Поделиться» ещё раз'); return; }
    }
    const ok = await copyText(text);
    toast(ok ? 'Этот браузер не умеет «Поделиться». Текст скопирован — картинку скачайте кнопкой «Картинка»'
      : 'Этот браузер не умеет «Поделиться». Скачайте картинку и скопируйте текст');
  }

  document.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-open],[data-toggle],[data-day],[data-close],[data-share],[data-copy],[data-more],[data-nav],.switch button');
    if (!t) return;
    if (t.dataset.nav) { navigate(Number(t.dataset.nav)); return; }
    if (t.dataset.toggle) { e.stopPropagation(); toggle(t.dataset.toggle); return; }
    if (t.dataset.open) { openSheet([t.dataset.open]); return; }
    if (t.dataset.day) { openSheet(items.filter((i) => i.date === t.dataset.day).map((i) => i.id)); return; }
    if ('close' in t.dataset) { closeSheet(); return; }
    if (t.dataset.share) { share(items.find((i) => i.id === t.dataset.share)); return; }
    if (t.dataset.copy) {
      const it = items.find((i) => i.id === t.dataset.copy);
      const ok = await copyText(shareText(it));
      if (!ok) toast('Не получилось скопировать — выделите текст пальцем');
      else toast(it.caption ? 'Текст с хэштегами скопирован' : 'Текст ещё готовится — скопирован заголовок');
      return;
    }
    if ('more' in t.dataset) { const p = t.closest('.post'); expand(p, p.querySelector('.card').hidden); return; }
    if (t.dataset.view) {
      view = t.dataset.view;
      try { localStorage.setItem('sn-content-plan-view', view); } catch { /* ничего */ }
      render(); window.scrollTo(0, 0);
    }
  });
  // …/#reel-t1 — одна публикация, …/#2026-12-31 — все публикации дня
  function openFromHash() {
    const h = decodeURIComponent(location.hash.slice(1));
    if (!h) return;
    if (items.some((i) => i.id === h)) openSheet([h]);
    else if (/^\d{4}-\d{2}-\d{2}$/.test(h)) {
      const ids = items.filter((i) => i.date === h).map((i) => i.id);
      if (ids.length) openSheet(ids);
    }
  }
  window.addEventListener('hashchange', openFromHash);
  document.addEventListener('keydown', (e) => {
    if ($('#sheet').hidden) return;
    if (e.key === 'Escape') closeSheet();
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '')) return;
      e.preventDefault(); navigate(e.key === 'ArrowLeft' ? -1 : 1);
    }
  });
  // свайп влево/вправо по поп-апу на телефоне
  let touch = null;
  const panelEl = $('.sheet-panel');
  panelEl.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) { touch = null; return; }
    touch = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
  }, { passive: true });
  panelEl.addEventListener('touchend', (e) => {
    if (!touch) return;
    const dx = e.changedTouches[0].clientX - touch.x; const dy = e.changedTouches[0].clientY - touch.y;
    const fast = Date.now() - touch.t < 700;
    touch = null;
    if (fast && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) navigate(dx < 0 ? 1 : -1);
  }, { passive: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && shared) refreshStatus(true); });

  // ---------- старт ----------
  async function start() {
    try { view = localStorage.getItem('sn-content-plan-view'); } catch { view = null; }
    if (view !== 'list' && view !== 'month') view = window.matchMedia('(min-width: 760px)').matches ? 'month' : 'list';
    try {
      const r = await fetch('data/plan.json', { cache: 'no-cache' });
      plan = await r.json();
    } catch {
      main.innerHTML = '<p class="error">Не получилось загрузить план. Если страница открыта двойным щелчком по файлу — запустите «Открыть локально.cmd».</p>';
      return;
    }
    items = plan.items || [];
    $('#updated').textContent = plan.updated ? `План обновлён ${fmtLong(plan.updated).split(',')[0]} ${plan.updated.slice(0, 4)}` : '';
    status = local.load();
    render();
    refreshStatus();
    // ссылка на конкретную публикацию: …/#reel-01, вид: …/?view=month
    const qv = new URLSearchParams(location.search).get('view');
    if (qv === 'list' || qv === 'month') { view = qv; render(); }
    openFromHash();
    if (shared) setInterval(() => { if (!document.hidden) refreshStatus(true); }, Math.max(15, CFG.refreshSeconds) * 1000);
  }
  start();
})();
