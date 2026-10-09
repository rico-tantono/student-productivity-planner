(() => {
'use strict';
/* ---------- constants & helpers ---------- */
const KEY = 'semesta.v1';
const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const COLORS = ['#7a9e9f','#c98a6b','#8f7aa8','#6b8f5e','#c4a24a','#b86b7a'];
const PRI = { Low: 0, Medium: 1, High: 2 };
const STAT = { todo: 'To Do', progress: 'In Progress', done: 'Completed' };
const $ = (s, e = document) => e.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const today = () => iso(new Date());
const fmt = s => parse(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/, TIME_RE = /^\d{2}:\d{2}$/;

/* ---------- storage ---------- */
function sample() {
  const t = new Date(), d = n => iso(addDays(t, n));
  const subjects = [
    { id: 'sub1', name: 'Database Systems', code: 'IS201', lecturer: 'Dr. Rahma', color: COLORS[0], isSample: true },
    { id: 'sub2', name: 'Business Analytics', code: 'IS230', lecturer: 'Mr. Dimas', color: COLORS[1], isSample: true },
    { id: 'sub3', name: 'Human-Computer Interaction', code: 'IS245', lecturer: 'Ms. Putri', color: COLORS[2], isSample: true }
  ];
  const mk = (title, subjectId, due, priority, status, est, description = '') =>
    ({ id: uid('t'), title, subjectId, due, priority, status, est, description, createdAt: Date.now(), completedAt: status === 'done' ? due : null, isSample: true });
  const tasks = [
    mk('ERD for library system', 'sub1', d(2), 'High', 'progress', 120, 'Draw the entity relationship diagram.'),
    mk('SQL joins worksheet', 'sub1', d(-1), 'Medium', 'todo', 60),
    mk('Dashboard case study', 'sub2', d(5), 'High', 'todo', 180),
    mk('Reading summary: chapter 4', 'sub2', d(-3), 'Low', 'done', 45),
    mk('Usability test plan', 'sub3', d(8), 'Medium', 'todo', 90),
    mk('Persona write-up', 'sub3', d(-2), 'Medium', 'done', 60)
  ];
  const cls = (subjectId, day, start, end, location) => ({ id: uid('c'), subjectId, day, start, end, location, isSample: true });
  return { subjects, tasks, classes: [cls('sub1', 1, '08:00', '10:00', 'Room 301'), cls('sub2', 3, '10:30', '12:30', 'Lab B'), cls('sub3', 4, '13:00', '15:00', 'Room 204'), cls('sub1', 5, '09:00', '11:00', 'Lab A')], settings: { weekStart: 1 } };
}
function validate(d) {
  if (!d || typeof d !== 'object' || !['subjects', 'tasks', 'classes'].every(k => Array.isArray(d[k]))) return null;
  const ok = d.subjects.every(s => s && s.id && s.name) &&
    d.tasks.every(t => t && t.id && t.title && DATE_RE.test(t.due) && t.status in STAT && t.priority in PRI) &&
    d.classes.every(c => c && c.id && c.day >= 0 && c.day <= 6 && TIME_RE.test(c.start) && TIME_RE.test(c.end));
  if (!ok) return null;
  const ws = Number(d.settings && d.settings.weekStart);
  return { subjects: d.subjects, tasks: d.tasks, classes: d.classes, settings: { weekStart: ws >= 0 && ws <= 6 ? ws : 1 } };
}
function load() {
  try { const v = validate(JSON.parse(localStorage.getItem(KEY))); if (v) return v; } catch (e) { /* fall through to sample */ }
  return sample();
}
let S = load();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Could not save: browser storage is full or blocked.'); } };
save();

/* ---------- ui state ---------- */
const now = new Date();
const ui = { view: 'dashboard', q: '', fs: '', fp: '', fst: '', sort: 'due', sched: 'week', day: now.getDay(), cal: { y: now.getFullYear(), m: now.getMonth(), sel: today() } };
const charts = {};
const sub = id => S.subjects.find(s => s.id === id);
const state = t => t.status === 'done' ? 'done' : t.due < today() ? 'overdue' : (parse(t.due) - parse(today())) / 864e5 <= 3 ? 'soon' : '';
const stateLabel = t => ({ done: 'Completed', overdue: 'Overdue', soon: 'Due soon' }[state(t)] || STAT[t.status]);
const timeRange = c => `${c.start}-${c.end}`;
const overlap = c => S.classes.find(o => o.id !== c.id && o.day === c.day && c.start < o.end && o.start < c.end);

/* ---------- feedback ---------- */
let toastTimer;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600); }
function confirmBox(title, text, ok = 'Delete') {
  return new Promise(res => {
    const d = $('#confirm'); $('#ctitle').textContent = title; $('#ctext').textContent = text; $('#cok').textContent = ok;
    d.returnValue = ''; d.addEventListener('close', () => res(d.returnValue === 'yes'), { once: true }); d.showModal();
  });
}
let onSubmit = null;
function openModal(title, body, handler) { $('#mtitle').textContent = title; $('#mbody').innerHTML = body; $('#merr').textContent = ''; onSubmit = handler; $('#modal').showModal(); const f = $('#mbody input,#mbody select'); if (f) f.focus(); }
$('#mform').addEventListener('submit', e => {
  e.preventDefault();
  const err = onSubmit(new FormData($('#mform')));
  if (err) $('#merr').textContent = err; else $('#modal').close();
});
$('#mcancel').addEventListener('click', () => $('#modal').close());

/* ---------- derived data ---------- */
function stats() {
  const t = S.tasks, done = t.filter(x => x.status === 'done').length, over = t.filter(x => state(x) === 'overdue').length;
  return { total: t.length, done, pending: t.length - done, over, pct: t.length ? Math.round(done / t.length * 100) : 0 };
}
function lastDays(n) {
  return Array.from({ length: n }, (_, i) => {
    const d = iso(addDays(new Date(), i - n + 1)), list = S.tasks.filter(t => t.completedAt === d);
    return { d, label: parse(d).toLocaleDateString('en-GB', { weekday: 'short' }), count: list.length, min: list.reduce((a, t) => a + (Number(t.est) || 0), 0) };
  });
}
function filtered() {
  const q = ui.q.trim().toLowerCase();
  const list = S.tasks.filter(t => (!q || t.title.toLowerCase().includes(q)) && (!ui.fs || t.subjectId === ui.fs) && (!ui.fp || t.priority === ui.fp) &&
    (!ui.fst || (ui.fst === 'overdue' ? state(t) === 'overdue' : t.status === ui.fst)));
  const by = { due: (a, b) => a.due.localeCompare(b.due), priority: (a, b) => PRI[b.priority] - PRI[a.priority] || a.due.localeCompare(b.due), created: (a, b) => b.createdAt - a.createdAt };
  return list.sort(by[ui.sort]);
}

/* ---------- view fragments ---------- */
const empty = (title, text) => `<div class="empty"><b>${title}</b>${text}</div>`;
const opts = (arr, sel) => arr.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(sel) ? 'selected' : ''}>${esc(l)}</option>`).join('');
const subOpts = sel => opts(S.subjects.map(s => [s.id, s.name]), sel);
const sampleTag = x => x.isSample ? ' <span class="sample">sample</span>' : '';

function taskRow(t) {
  const s = sub(t.subjectId), st = state(t);
  return `<div class="item ${t.status === 'done' ? 'done' : ''}">
    <input type="checkbox" style="width:auto" data-act="toggle" data-id="${t.id}" ${t.status === 'done' ? 'checked' : ''} aria-label="Mark ${esc(t.title)} as completed">
    <span class="dot" style="--c:${s ? s.color : '#999'}"></span>
    <div class="grow"><div class="t">${esc(t.title)}${sampleTag(t)}</div>
    <div class="m">${esc(s ? s.name : 'No subject')}, due ${fmt(t.due)}${t.est ? `, ${t.est} min` : ''}</div></div>
    <span class="badge ${t.priority}">${t.priority}</span><span class="badge ${st}">${stateLabel(t)}</span>
    <button class="btn ghost sm" data-act="editTask" data-id="${t.id}">Edit</button>
    <button class="btn ghost sm" data-act="delTask" data-id="${t.id}" aria-label="Delete ${esc(t.title)}">Delete</button></div>`;
}
const taskList = list => list.length ? list.map(taskRow).join('') : empty('No assignments found', 'Try different filters, or add a new assignment.');
const classRow = c => { const s = sub(c.subjectId); return `<button class="cls" style="--c:${s ? s.color : '#999'}" data-act="editClass" data-id="${c.id}"><b>${esc(s ? s.name : 'Class')}</b>${timeRange(c)}${c.location ? ', ' + esc(c.location) : ''}</button>`; };
const classesOn = day => S.classes.filter(c => c.day === day).sort((a, b) => a.start.localeCompare(b.start));
const head = (title, actions = '') => `<div class="head"><h1 class="pt">${title}</h1><div>${actions}</div></div>`;

const views = {
  dashboard() {
    const s = stats(), wk = lastDays(7), mins = wk.reduce((a, d) => a + d.min, 0);
    const up = S.tasks.filter(t => t.status !== 'done').sort((a, b) => a.due.localeCompare(b.due)).slice(0, 5);
    const tc = classesOn(new Date().getDay());
    return head('Dashboard', '<button class="btn dark" data-act="addTask">New assignment</button>') + `
    <div class="grid g4">
      <div class="card stat"><b>${s.total}</b><span>Total assignments</span></div>
      <div class="card stat"><b>${s.pending}</b><span>Pending</span></div>
      <div class="card stat"><b class="ok">${s.done}</b><span>Completed</span></div>
      <div class="card stat"><b class="bad">${s.over}</b><span>Overdue</span></div></div>
    <div class="grid g2" style="margin-top:16px">
      <div class="card beige"><h2>Completion: ${s.pct}%</h2><div class="bar"><i style="width:${s.pct}%"></i></div>
        <p class="sub" style="margin-top:12px">${wk.reduce((a, d) => a + d.count, 0)} assignments finished in the last 7 days, about ${(mins / 60).toFixed(1)} study hours logged from their estimates.</p></div>
      <div class="card"><h2>Today's schedule</h2>${tc.length ? tc.map(classRow).join('') : empty('No classes today', 'Enjoy the free time or plan some study.')}</div></div>
    <div class="grid g2" style="margin-top:16px">
      <div class="card"><h2>Upcoming deadlines</h2>${up.length ? up.map(taskRow).join('') : empty('All caught up', 'No pending assignments.')}</div>
      <div class="card"><h2>This week</h2><div class="chartbox"><canvas id="chWeek"></canvas></div></div></div>`;
  },
  tasks() {
    return head('Assignments', '<button class="btn dark" data-act="addTask">New assignment</button>') + `
    <div class="tools">
      <label class="sr" for="fq">Search</label><input id="fq" data-f="q" type="search" placeholder="Search by title" value="${esc(ui.q)}">
      <label class="sr" for="fs">Subject</label><select id="fs" data-f="fs"><option value="">All subjects</option>${subOpts(ui.fs)}</select>
      <label class="sr" for="fp">Priority</label><select id="fp" data-f="fp"><option value="">All priorities</option>${opts(Object.keys(PRI).map(p => [p, p]), ui.fp)}</select>
      <label class="sr" for="fst">Status</label><select id="fst" data-f="fst"><option value="">All statuses</option>${opts([...Object.entries(STAT), ['overdue', 'Overdue']], ui.fst)}</select>
      <label class="sr" for="fso">Sort</label><select id="fso" data-f="sort">${opts([['due', 'Sort: deadline'], ['priority', 'Sort: priority'], ['created', 'Sort: newest']], ui.sort)}</select></div>
    <div class="card" id="tlist">${taskList(filtered())}</div>`;
  },
  schedule() {
    const ws = S.settings.weekStart, order = Array.from({ length: 7 }, (_, i) => (ws + i) % 7), td = new Date().getDay();
    const add = '<button class="btn dark" data-act="addClass">Add class</button>';
    if (!S.classes.length) return head('Weekly schedule', add) + empty('No classes yet', 'Add your first class to build your timetable.');
    const seg = `<div class="seg" style="margin-bottom:14px"><button class="${ui.sched === 'week' ? 'on' : ''}" data-act="mode" data-id="week">Week</button><button class="${ui.sched === 'day' ? 'on' : ''}" data-act="mode" data-id="day">Day</button></div>`;
    if (ui.sched === 'day') {
      const tabs = `<div class="seg" style="margin-bottom:14px;flex-wrap:wrap">${order.map(d => `<button class="${d === ui.day ? 'on' : ''}" data-act="pickDay" data-id="${d}">${DAYS[d].slice(0, 3)}${d === td ? ' (today)' : ''}</button>`).join('')}</div>`;
      const list = classesOn(ui.day);
      return head('Weekly schedule', add) + seg + '<br>' + tabs + `<div class="card">${list.length ? list.map(classRow).join('') : empty('Nothing on ' + DAYS[ui.day], 'No classes scheduled for this day.')}</div>`;
    }
    return head('Weekly schedule', add) + seg + `<div class="week">${order.map(d => `<div class="col ${d === td ? 'today' : ''}"><h3>${DAYS[d]}${d === td ? ' (today)' : ''}</h3>${classesOn(d).map(classRow).join('') || '<span class="sub">Free</span>'}</div>`).join('')}</div>`;
  },
  calendar() {
    const { y, m, sel } = ui.cal, ws = S.settings.weekStart, first = new Date(y, m, 1);
    const start = addDays(first, -((first.getDay() - ws + 7) % 7)), td = today();
    const names = Array.from({ length: 7 }, (_, i) => `<div class="dn">${DAYS[(ws + i) % 7].slice(0, 3)}</div>`).join('');
    const cells = Array.from({ length: 42 }, (_, i) => {
      const d = addDays(start, i), k = iso(d), ts = S.tasks.filter(t => t.due === k);
      const dots = ts.map(t => `<i class="d-${state(t) === 'done' ? 'done' : state(t) === 'overdue' ? 'overdue' : 'pending'}"></i>`).join('') + (S.classes.some(c => c.day === d.getDay()) ? '<i class="d-class"></i>' : '');
      return `<button class="day ${d.getMonth() !== m ? 'out' : ''} ${k === td ? 'today' : ''} ${k === sel ? 'sel' : ''}" data-act="pickDate" data-id="${k}" aria-label="${fmt(k)}, ${ts.length} due"><span>${d.getDate()}</span><span class="dots">${dots}</span></button>`;
    }).join('');
    const ts = S.tasks.filter(t => t.due === sel), cs = classesOn(parse(sel).getDay());
    return head('Calendar') + `<div class="grid g2" style="grid-template-columns:1.4fr 1fr;align-items:start">
      <div><div class="head" style="margin-bottom:10px"><button class="btn ghost sm" data-act="calPrev">Previous</button><b>${first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</b><button class="btn ghost sm" data-act="calNext">Next</button></div>
      <div class="cal">${names}${cells}</div>
      <p class="sub" style="margin-top:10px;font-size:13px">Dots: pending (amber), completed (green), overdue (red), class day (grey).</p></div>
      <div class="card"><h2>${fmt(sel)}</h2><h3 class="sub" style="font-size:13px">Assignments</h3>${ts.length ? ts.map(taskRow).join('') : '<p class="sub">Nothing due.</p>'}
      <h3 class="sub" style="font-size:13px;margin-top:14px">Classes</h3>${cs.length ? cs.map(classRow).join('') : '<p class="sub">No classes.</p>'}
      <div class="row end"><button class="btn dark sm" data-act="addTask" data-id="${sel}">Add assignment on this date</button></div></div></div>`;
  },
  subjects() {
    const rows = S.subjects.map(s => {
      const n = S.tasks.filter(t => t.subjectId === s.id).length;
      return `<div class="item"><span class="dot" style="--c:${s.color}"></span><div class="grow"><div class="t">${esc(s.name)}${s.code ? ' (' + esc(s.code) + ')' : ''}${sampleTag(s)}</div><div class="m">${s.lecturer ? esc(s.lecturer) + ', ' : ''}${n} assignment${n === 1 ? '' : 's'}</div></div>
      <button class="btn ghost sm" data-act="editSub" data-id="${s.id}">Edit</button><button class="btn ghost sm" data-act="delSub" data-id="${s.id}">Delete</button></div>`;
    }).join('');
    return head('Subjects', '<button class="btn dark" data-act="addSub">New subject</button>') + `<div class="card">${rows || empty('No subjects yet', 'Add the courses you are taking this semester.')}</div>`;
  },
  progress() {
    const s = stats();
    const bars = S.subjects.map(x => { const l = S.tasks.filter(t => t.subjectId === x.id), d = l.filter(t => t.status === 'done').length, p = l.length ? Math.round(d / l.length * 100) : 0;
      return `<div style="margin-bottom:14px"><div class="row" style="justify-content:space-between"><span><span class="dot" style="--c:${x.color};display:inline-block"></span> ${esc(x.name)}</span><span class="sub">${d}/${l.length} (${p}%)</span></div><div class="bar"><i style="width:${p}%;background:${x.color}"></i></div></div>`; }).join('');
    return head('Progress') + `<div class="grid g2"><div class="card"><h2>Completion rate: ${s.pct}%</h2><div class="chartbox"><canvas id="chDone"></canvas></div></div>
      <div class="card"><h2>Completed per day (last 14 days)</h2><div class="chartbox"><canvas id="chTrend"></canvas></div></div></div>
      <div class="card" style="margin-top:16px"><h2>Progress by subject</h2>${bars || '<p class="sub">Add subjects and assignments to see progress.</p>'}</div>`;
  },
  settings() {
    return head('Settings') + `<div class="grid g2" style="align-items:start"><div class="card"><h2>Preferences</h2><label for="ws">Week starts on</label>
      <select id="ws" data-f="ws">${opts(DAYS.map((d, i) => [i, d]), S.settings.weekStart)}</select>
      <p class="sub" style="margin-top:12px;font-size:13px">Your data lives in this browser only. It is not synced across devices.</p></div>
      <div class="card"><h2>Data</h2><div class="grid">
      <button class="btn ghost" data-act="export">Export backup (JSON)</button>
      <button class="btn ghost" data-act="pickFile">Import backup</button><input type="file" id="imp" data-f="import" accept="application/json" hidden>
      <button class="btn ghost" data-act="removeSample">Remove sample data</button>
      <button class="btn danger" data-act="clear">Clear all data</button></div></div></div>`;
  }
};
const NAV = [['dashboard', 'Dashboard'], ['tasks', 'Assignments'], ['schedule', 'Schedule'], ['calendar', 'Calendar'], ['subjects', 'Subjects'], ['progress', 'Progress'], ['settings', 'Settings']];

/* ---------- charts ---------- */
function drawCharts() {
  Object.values(charts).forEach(c => c.destroy()); Object.keys(charts).forEach(k => delete charts[k]);
  if (typeof Chart === 'undefined') return;
  const make = (id, cfg) => { const el = $('#' + id); if (el) charts[id] = new Chart(el, { ...cfg, options: { responsive: true, maintainAspectRatio: false, ...cfg.options } }); };
  const ink = '#1b1917', beige = '#e6d9ca', y = { beginAtZero: true, ticks: { precision: 0 } };
  const w = lastDays(7), s = stats();
  make('chWeek', { type: 'bar', data: { labels: w.map(d => d.label), datasets: [{ label: 'Completed', data: w.map(d => d.count), backgroundColor: ink, borderRadius: 4 }] }, options: { scales: { y }, plugins: { legend: { display: false } } } });
  make('chDone', { type: 'doughnut', data: { labels: ['Completed', 'Pending', 'Overdue'], datasets: [{ data: [s.done, s.pending - s.over, s.over], backgroundColor: ['#4f8a5b', beige, '#c4503f'] }] } });
  const t = lastDays(14);
  make('chTrend', { type: 'line', data: { labels: t.map(d => d.d.slice(5)), datasets: [{ label: 'Completed', data: t.map(d => d.count), borderColor: ink, backgroundColor: beige, fill: true, tension: .3 }] }, options: { scales: { y }, plugins: { legend: { display: false } } } });
}

/* ---------- router & render ---------- */
function render() {
  $('#nav').innerHTML = NAV.map(([k, l]) => `<a href="#${k}" class="${k === ui.view ? 'on' : ''}" ${k === ui.view ? 'aria-current="page"' : ''}>${l}</a>`).join('') + '<a href="#about">About us</a>';
  $('#view').innerHTML = views[ui.view]();
  drawCharts();
}
function route() {
  const h = location.hash.slice(1) || 'home', isApp = h in views;
  const isAbout = h === 'about';
  $('#landing').hidden = isApp; $('#app').hidden = !isApp;
  $('#homeMain').hidden = isAbout; $('#about').hidden = !isAbout;
  $('#aboutLink').classList.toggle('on', isAbout);
  document.title = isAbout ? 'About Semesta' : 'Semesta – Student Study Planner';
  if (isApp) { ui.view = h; render(); window.scrollTo(0, 0); } else window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);
$('#topSearch').addEventListener('submit', e => { e.preventDefault(); ui.q = $('#topQ').value; location.hash = '#tasks'; route(); });

/* ---------- forms ---------- */
function taskForm(t = {}, date) {
  if (!S.subjects.length) { toast('Add a subject first.'); location.hash = '#subjects'; return; }
  const body = `<label for="f-title">Title</label><input id="f-title" name="title" value="${esc(t.title)}" maxlength="120" required>
    <label for="f-sub">Subject</label><select id="f-sub" name="subjectId">${subOpts(t.subjectId)}</select>
    <label for="f-desc">Description (optional)</label><textarea id="f-desc" name="description" rows="2">${esc(t.description)}</textarea>
    <div class="row"><div><label for="f-due">Due date</label><input id="f-due" type="date" name="due" value="${esc(t.due || date || today())}" required></div>
    <div><label for="f-est">Estimate (minutes)</label><input id="f-est" type="number" min="0" max="2000" name="est" value="${esc(t.est)}"></div></div>
    <div class="row"><div><label for="f-pri">Priority</label><select id="f-pri" name="priority">${opts(Object.keys(PRI).map(p => [p, p]), t.priority || 'Medium')}</select></div>
    <div><label for="f-st">Status</label><select id="f-st" name="status">${opts(Object.entries(STAT), t.status || 'todo')}</select></div></div>`;
  openModal(t.id ? 'Edit assignment' : 'New assignment', body, f => {
    const title = f.get('title').trim(), due = f.get('due'), est = f.get('est');
    if (!title) return 'Enter a title for the assignment.';
    if (!DATE_RE.test(due)) return 'Choose a valid due date.';
    if (est !== '' && (isNaN(est) || Number(est) < 0)) return 'Estimate must be a positive number of minutes.';
    const status = f.get('status'), rec = { ...t, title, subjectId: f.get('subjectId'), description: f.get('description').trim(), due, priority: f.get('priority'), status, est: est === '' ? '' : Number(est) };
    rec.completedAt = status === 'done' ? (t.completedAt || today()) : null;
    if (t.id) S.tasks = S.tasks.map(x => x.id === t.id ? rec : x); else S.tasks.push({ ...rec, id: uid('t'), createdAt: Date.now() });
    commit(t.id ? 'Assignment updated.' : 'Assignment added.');
  });
}
function classForm(c = {}) {
  if (!S.subjects.length) { toast('Add a subject first.'); location.hash = '#subjects'; return; }
  const body = `<label for="c-sub">Subject</label><select id="c-sub" name="subjectId">${subOpts(c.subjectId)}</select>
    <label for="c-day">Day</label><select id="c-day" name="day">${opts(DAYS.map((d, i) => [i, d]), c.day ?? (new Date().getDay()))}</select>
    <div class="row"><div><label for="c-s">Start</label><input id="c-s" type="time" name="start" value="${esc(c.start || '08:00')}" required></div>
    <div><label for="c-e">End</label><input id="c-e" type="time" name="end" value="${esc(c.end || '10:00')}" required></div></div>
    <label for="c-l">Location (optional)</label><input id="c-l" name="location" value="${esc(c.location)}" maxlength="60">
    ${c.id ? '<div class="row end" style="justify-content:flex-start"><button type="button" class="btn danger sm" id="c-del">Delete class</button></div>' : ''}`;
  let ack = '';
  openModal(c.id ? 'Edit class' : 'Add class', body, f => {
    const rec = { ...c, subjectId: f.get('subjectId'), day: Number(f.get('day')), start: f.get('start'), end: f.get('end'), location: f.get('location').trim() };
    if (!TIME_RE.test(rec.start) || !TIME_RE.test(rec.end)) return 'Enter a start and end time.';
    if (rec.end <= rec.start) return 'End time must be after the start time.';
    const o = overlap(rec), key = `${rec.day}${rec.start}${rec.end}`;
    if (o && ack !== key) { ack = key; return `This overlaps with ${(sub(o.subjectId) || {}).name || 'another class'} (${timeRange(o)}). Press Save again to keep both.`; }
    if (c.id) S.classes = S.classes.map(x => x.id === c.id ? rec : x); else S.classes.push({ ...rec, id: uid('c') });
    commit(c.id ? 'Class updated.' : 'Class added.');
  });
  const del = $('#c-del');
  if (del) del.addEventListener('click', async () => { $('#modal').close(); if (await confirmBox('Delete this class?', 'It will be removed from your timetable.')) { S.classes = S.classes.filter(x => x.id !== c.id); commit('Class deleted.'); } });
}
function subForm(s = {}) {
  const cur = s.color || COLORS[S.subjects.length % COLORS.length];
  const body = `<label for="s-n">Subject name</label><input id="s-n" name="name" value="${esc(s.name)}" maxlength="80" required>
    <div class="row"><div><label for="s-c">Course code (optional)</label><input id="s-c" name="code" value="${esc(s.code)}" maxlength="20"></div>
    <div><label for="s-l">Lecturer (optional)</label><input id="s-l" name="lecturer" value="${esc(s.lecturer)}" maxlength="60"></div></div>
    <label>Color</label><div class="colors">${COLORS.map(c => `<label><span class="sr">${c}</span><input type="radio" name="color" value="${c}" style="--c:${c}" ${c === cur ? 'checked' : ''}></label>`).join('')}</div>`;
  openModal(s.id ? 'Edit subject' : 'New subject', body, f => {
    const name = f.get('name').trim();
    if (!name) return 'Enter a subject name.';
    if (S.subjects.some(x => x.id !== s.id && x.name.toLowerCase() === name.toLowerCase())) return 'A subject with this name already exists.';
    const rec = { ...s, name, code: f.get('code').trim(), lecturer: f.get('lecturer').trim(), color: f.get('color') || cur };
    if (s.id) S.subjects = S.subjects.map(x => x.id === s.id ? rec : x); else S.subjects.push({ ...rec, id: uid('s') });
    commit(s.id ? 'Subject updated.' : 'Subject added.');
  });
}
function commit(msg) { save(); render(); if (msg) toast(msg); }

/* ---------- actions ---------- */
const byId = (arr, id) => arr.find(x => x.id === id);
const A = {
  addTask: id => taskForm({}, id),
  editTask: id => taskForm(byId(S.tasks, id)),
  toggle: id => { const t = byId(S.tasks, id); t.status = t.status === 'done' ? 'todo' : 'done'; t.completedAt = t.status === 'done' ? today() : null; commit(t.status === 'done' ? 'Marked as completed.' : 'Moved back to To Do.'); },
  async delTask(id) { if (await confirmBox('Delete this assignment?', 'This cannot be undone.')) { S.tasks = S.tasks.filter(t => t.id !== id); commit('Assignment deleted.'); } },
  addClass: () => classForm(),
  editClass: id => classForm(byId(S.classes, id)),
  mode: id => { ui.sched = id; render(); },
  pickDay: id => { ui.day = Number(id); render(); },
  addSub: () => subForm(),
  editSub: id => subForm(byId(S.subjects, id)),
  async delSub(id) {
    const s = byId(S.subjects, id), nt = S.tasks.filter(t => t.subjectId === id).length, nc = S.classes.filter(c => c.subjectId === id).length;
    const msg = nt || nc ? `"${s.name}" has ${nt} assignment${nt === 1 ? '' : 's'} and ${nc} class${nc === 1 ? '' : 'es'}. Deleting the subject will permanently delete them too.` : `Delete "${s.name}"?`;
    if (await confirmBox('Delete subject?', msg, nt || nc ? 'Delete everything' : 'Delete')) {
      S.subjects = S.subjects.filter(x => x.id !== id); S.tasks = S.tasks.filter(t => t.subjectId !== id); S.classes = S.classes.filter(c => c.subjectId !== id);
      commit('Subject deleted.');
    }
  },
  pickDate: id => { ui.cal.sel = id; render(); },
  calPrev: () => { const c = ui.cal, d = new Date(c.y, c.m - 1, 1); c.y = d.getFullYear(); c.m = d.getMonth(); render(); },
  calNext: () => { const c = ui.cal, d = new Date(c.y, c.m + 1, 1); c.y = d.getFullYear(); c.m = d.getMonth(); render(); },
  export() {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' }));
    a.download = `semesta-backup-${today()}.json`; a.click(); URL.revokeObjectURL(a.href); toast('Backup downloaded.');
  },
  pickFile: () => $('#imp').click(),
  async removeSample() {
    if (await confirmBox('Remove sample data?', 'Only the example subjects, assignments and classes are removed. Your own entries stay.', 'Remove')) {
      const gone = new Set(S.subjects.filter(s => s.isSample).map(s => s.id));
      S.subjects = S.subjects.filter(s => !s.isSample); S.tasks = S.tasks.filter(t => !t.isSample && !gone.has(t.subjectId)); S.classes = S.classes.filter(c => !c.isSample && !gone.has(c.subjectId));
      commit('Sample data removed.');
    }
  },
  async clear() { if (await confirmBox('Clear all data?', 'Every subject, assignment and class will be permanently deleted from this browser. Export a backup first if you may need it.', 'Clear everything')) { S = { subjects: [], tasks: [], classes: [], settings: S.settings }; commit('All data cleared.'); } }
};
$('#view').addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b && A[b.dataset.act]) A[b.dataset.act](b.dataset.id, b); });
const refreshList = () => { const l = $('#tlist'); if (l) l.innerHTML = taskList(filtered()); };
function onField(e) {
  const f = e.target.dataset.f; if (!f) return;
  if (f === 'import') { importFile(e.target.files[0]); e.target.value = ''; return; }
  if (f === 'ws') { S.settings.weekStart = Number(e.target.value); commit('Week start updated.'); return; }
  ui[f] = e.target.value; refreshList();
}
$('#view').addEventListener('input', e => { if (e.target.dataset.f === 'q') onField(e); });
$('#view').addEventListener('change', e => { if (e.target.dataset.f !== 'q') onField(e); });
function importFile(file) {
  if (!file) return;
  const r = new FileReader();
  r.onload = async () => {
    let data = null; try { data = validate(JSON.parse(r.result)); } catch (e) { /* invalid JSON */ }
    if (!data) { toast('Import failed: this is not a valid Semesta backup.'); return; }
    if (await confirmBox('Replace current data?', `The backup has ${data.subjects.length} subjects, ${data.tasks.length} assignments and ${data.classes.length} classes. Your current data will be replaced.`, 'Replace')) { S = data; commit('Backup imported.'); }
  };
  r.readAsText(file);
}
route();
})();
