import { addDays, dateFromKey, dayKey, demoState, migrateState, progress, toggleStep, tomorrow, validState, weekDays, weekStart, weekSummary } from './model.js';

const $ = selector => document.querySelector(selector);
const esc = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const storageKey = 'rumbo.state.v1';
const shortDate = key => new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' }).format(dateFromKey(key));
const weekday = key => new Intl.DateTimeFormat('es', { weekday: 'short' }).format(dateFromKey(key)).replace('.', '');
let state;
let storageBlocked = false;
let activeProject = null;
let activeStep = null;
let plannerWeek = weekStart();
let reviewWeek = plannerWeek;
let toastTimer;

try {
  const saved = localStorage.getItem(storageKey);
  const migrated = saved ? migrateState(JSON.parse(saved)) : demoState();
  if (!validState(migrated)) throw new Error('invalid');
  state = migrated;
  if (saved && JSON.parse(saved).version === 1) localStorage.setItem(storageKey, JSON.stringify(state));
} catch {
  state = demoState();
  storageBlocked = true;
  $('#storage-warning').hidden = false;
  $('#storage-warning').textContent = 'No pudimos leer los datos guardados. Esta sesión es temporal; no se sobrescribirán los datos anteriores.';
}

function save() {
  if (!storageBlocked) {
    try { localStorage.setItem(storageKey, JSON.stringify(state)); }
    catch {
      $('#storage-warning').hidden = false;
      $('#storage-warning').textContent = 'No se pudieron guardar los cambios. Permanecerán solo durante esta sesión.';
    }
  }
  render();
}

function toast(message) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 3500);
}

function allSteps() {
  return state.projects.flatMap(project => project.steps.map(step => ({ ...step, project })));
}

function findStep(projectId, stepId) {
  return state.projects.find(project => project.id === projectId)?.steps.find(step => step.id === stepId);
}

function pageHeading(eyebrow, title, subtitle, action = '<button class="primary" data-action="new">＋ Nuevo aprendizaje</button>') {
  return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${subtitle}</p></div>${action}</div>`;
}

function taskRow(step, project, compact = false) {
  return `<article class="task ${step.done ? 'done' : ''} ${compact ? 'compact' : ''}">
    <button class="check" data-action="toggle" data-project="${esc(project.id)}" data-step="${esc(step.id)}" aria-label="${step.done ? 'Desmarcar' : 'Completar'} ${esc(step.title)}" aria-pressed="${step.done}">${step.done ? '✓' : ''}</button>
    <div class="task-text"><span class="task-project">${esc(project.title)} ${step.date < dayKey() && !step.done ? '<span class="overdue">· Pendiente anterior</span>' : ''}</span><strong>${esc(step.title)}</strong></div>
    <span class="minutes">${step.minutes} min</span>
    ${!step.done ? `<button class="log-button" data-action="log" data-project="${esc(project.id)}" data-step="${esc(step.id)}">Avancé</button>` : ''}
    ${!compact && !step.done ? `<button class="defer" data-action="tomorrow" data-project="${esc(project.id)}" data-step="${esc(step.id)}" title="Mover a mañana">Mañana ↗</button>` : ''}
  </article>`;
}

function projectCard(project) {
  const done = project.steps.filter(step => step.done).length;
  const percent = progress(project);
  const next = project.steps.find(step => !step.done);
  return `<button class="project-card color-${project.color % 3}" data-action="detail" data-project="${esc(project.id)}"><div class="card-top"><span class="project-icon" aria-hidden="true">${project.type === 'Curso' ? '▤' : project.type === 'Habilidad' ? '✦' : '▧'}</span><span class="type">${project.type}</span><span class="card-arrow" aria-hidden="true">↗</span></div><h3>${esc(project.title)}</h3><p class="goal">${esc(project.goal)}</p><div class="progress-label"><span>${done} de ${project.steps.length} pasos</span><strong>${percent}%</strong></div><progress value="${percent}" max="100" aria-label="Progreso de ${esc(project.title)}">${percent}%</progress><div class="card-next">${next ? `<small>SIGUIENTE PASO</small><span>${esc(next.title)}</span>` : '<span>✓ Todos los pasos completados</span>'}</div></button>`;
}

function emptyState(title, copy, action, label) {
  return `<div class="empty"><span aria-hidden="true">✦</span><h3>${title}</h3><p>${copy}</p><button class="secondary" data-action="${action}">${label} ↗</button></div>`;
}

function renderToday() {
  const steps = allSteps();
  const today = steps.filter(step => step.date && step.date <= dayKey() && (!step.done || step.date === dayKey()));
  const pending = today.filter(step => !step.done);
  const completedToday = steps.filter(step => step.completedAt && dayKey(new Date(step.completedAt)) === dayKey()).length;
  const active = state.projects.filter(project => progress(project) < 100).length;
  const hero = pageHeading('VAMOS PASO A PASO', 'Hoy es un buen día<br>para <em>avanzar.</em>', 'Una cosa a la vez. Cada paso cuenta.');
  const stats = `<div class="stats"><div><span>Aprendizajes activos</span><strong>${active}<small>en marcha</small></strong></div><div><span>Avances de hoy</span><strong>${completedToday}<small>completados</small></strong></div><div><span>Tiempo pendiente hoy</span><strong>${pending.reduce((sum, step) => sum + step.minutes, 0)}<small>min estimados</small></strong></div></div>`;
  const tasks = today.map(step => taskRow(step, step.project)).join('');
  const empty = emptyState(state.projects.length ? 'Tu día tiene espacio' : 'Tu próximo aprendizaje empieza aquí', state.projects.length ? 'Planificá un paso desde Mi semana. Con 1–3 prioridades alcanza.' : 'Agregá un curso, habilidad o proyecto y dividilo en pasos pequeños.', state.projects.length ? 'week' : 'new', state.projects.length ? 'Planificar mi semana' : 'Crear mi primer aprendizaje');
  return hero + stats + `<section class="today-section"><div class="section-heading"><h2>Mi enfoque de hoy <span class="count">${pending.length}</span></h2><span>Completá o registrá un avance parcial</span></div><div class="task-list">${tasks || empty}</div>${pending.length > 3 ? '<p class="help">Tenés más de 3 prioridades. Podés mover alguna a mañana para aligerar tu día.</p>' : ''}</section><section class="learning-section"><div class="section-heading"><h2>En lo que estoy trabajando</h2><a href="#panel">Ver todo ↗</a></div><div class="project-grid">${state.projects.map(projectCard).join('') || empty}</div></section>`;
}

function renderPanel() {
  const steps = allSteps();
  const sessions = state.sessions;
  const stats = `<div class="stats"><div><span>Aprendizajes activos</span><strong>${state.projects.filter(project => progress(project) < 100).length}<small>en marcha</small></strong></div><div><span>Pasos completados</span><strong>${steps.filter(step => step.done).length}<small>en total</small></strong></div><div><span>Tiempo registrado</span><strong>${Math.round(sessions.reduce((sum, session) => sum + session.minutes, 0) / 60 * 10) / 10}<small>horas</small></strong></div></div>`;
  return pageHeading('TU MAPA DE APRENDIZAJE', 'Mis aprendizajes', 'Todo lo que estás aprendiendo y construyendo, en un lugar.') + stats + `<section class="learning-section"><div class="section-heading"><h2>Mi recorrido</h2></div><div class="project-grid">${state.projects.map(projectCard).join('') || emptyState('Tu próximo aprendizaje empieza aquí', 'Agregá un curso, habilidad o proyecto y dividilo en pasos pequeños.', 'new', 'Crear mi primer aprendizaje')}</div></section>`;
}

function plannerTask(step, project) {
  return `<article class="planner-task color-${project.color % 3} ${step.done ? 'done' : ''}" data-project="${esc(project.id)}" data-step="${esc(step.id)}"><div><small>${esc(project.title)}</small><strong>${esc(step.title)}</strong></div><div class="planner-actions"><span>${step.minutes} min</span>${!step.done ? `<button data-action="log" data-project="${esc(project.id)}" data-step="${esc(step.id)}" aria-label="Registrar avance">＋</button>` : '<span class="completed-mark">✓</span>'}</div></article>`;
}

function renderWeek() {
  const days = weekDays(plannerWeek);
  const summary = weekSummary(state, plannerWeek);
  const isCurrent = plannerWeek === weekStart();
  const end = days[6];
  const review = state.reviews.find(item => item.week === plannerWeek);
  const headerAction = '<button class="primary" data-action="plan">＋ Planificar paso</button>';
  const navigation = `<div class="week-toolbar"><div class="week-nav"><button class="icon-button" data-action="prev-week" aria-label="Semana anterior">←</button><button class="secondary" data-action="current-week">Esta semana</button><button class="icon-button" data-action="next-week" aria-label="Semana siguiente">→</button></div><strong>${shortDate(plannerWeek)} – ${shortDate(end)}</strong></div>`;
  const stats = `<div class="stats week-stats"><div><span>Pasos planificados</span><strong>${summary.planned}<small>esta semana</small></strong></div><div><span>Completados</span><strong>${summary.completed}<small>de ${summary.planned}</small></strong></div><div><span>Tiempo registrado</span><strong>${summary.minutes}<small>minutos</small></strong></div></div>`;
  const board = `<div class="week-board">${days.map(key => {
    const tasks = allSteps().filter(step => step.date === key);
    const isToday = key === dayKey();
    return `<section class="day-column ${isToday ? 'is-today' : ''}"><header><span>${weekday(key)}</span><strong>${dateFromKey(key).getDate()}</strong>${isToday ? '<small>HOY</small>' : ''}</header><div class="day-tasks">${tasks.map(step => plannerTask(step, step.project)).join('') || '<button class="day-empty" data-action="plan-date" data-date="' + key + '">＋ Agregar paso</button>'}</div><div class="day-total">${tasks.reduce((sum, step) => sum + step.minutes, 0)} min</div></section>`;
  }).join('')}</div>`;
  const backlog = allSteps().filter(step => !step.done && (!step.date || step.date < plannerWeek || step.date > end));
  const reviewCard = `<section class="review-card ${review ? 'reviewed' : ''}"><div><span class="review-icon">${review ? '✓' : '✦'}</span><div><h2>${review ? 'Revisión guardada' : 'Cerrá la semana con claridad'}</h2><p>${review ? `Próxima prioridad: ${esc(review.nextFocus || 'Aún no definida')}` : 'Revisá qué avanzaste y elegí una prioridad para la próxima semana.'}</p></div></div><button class="${review ? 'secondary' : 'primary'}" data-action="review">${review ? 'Editar revisión' : 'Hacer revisión semanal'}</button></section>`;
  const backlogHtml = `<section class="backlog"><div class="section-heading"><h2>Pasos sin planificar <span class="count">${backlog.length}</span></h2><span>Elegí solo lo que realmente podés hacer</span></div><div class="backlog-list">${backlog.slice(0, 8).map(step => `<button data-action="plan-step" data-project="${esc(step.project.id)}" data-step="${esc(step.id)}"><span><small>${esc(step.project.title)}</small><strong>${esc(step.title)}</strong></span><span>Planificar ↗</span></button>`).join('') || '<p>Todo lo pendiente ya tiene un lugar.</p>'}</div></section>`;
  return pageHeading(isCurrent ? 'TU SEMANA' : 'PLANIFICACIÓN', 'Mi semana', 'Decidí qué vas a hacer y protegé tiempo para hacerlo.', headerAction) + navigation + stats + board + reviewCard + backlogHtml;
}

function render() {
  const route = location.hash === '#panel' ? 'panel' : location.hash === '#semana' ? 'semana' : 'hoy';
  document.querySelectorAll('[data-nav]').forEach(link => {
    const active = link.dataset.nav === route;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
  $('#date-label').textContent = new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  $('#demo-banner').hidden = !state.demo;
  $('#view').innerHTML = route === 'panel' ? renderPanel() : route === 'semana' ? renderWeek() : renderToday();
}

function openDetail(id) {
  activeProject = id;
  drawDetail();
  if (!$('#detail-dialog').open) $('#detail-dialog').showModal();
}

function drawDetail() {
  const project = state.projects.find(item => item.id === activeProject);
  if (!project) return;
  $('#detail-content').innerHTML = `<div class="dialog-heading"><span class="type">${project.type}</span><button class="icon-button" data-close="detail-dialog" aria-label="Cerrar">×</button></div><h2 id="detail-title">${esc(project.title)}</h2><p>${esc(project.goal)}</p><div class="progress-label"><span>Tu recorrido</span><strong>${progress(project)}%</strong></div><progress value="${progress(project)}" max="100" aria-label="Progreso">${progress(project)}%</progress><div class="detail-steps">${project.steps.map(step => {
    const logged = state.sessions.filter(session => session.stepId === step.id).reduce((sum, session) => sum + session.minutes, 0);
    return `<div class="detail-step"><div class="step-heading"><button class="check ${step.done ? 'checked' : ''}" data-action="toggle" data-project="${esc(project.id)}" data-step="${esc(step.id)}" aria-label="${step.done ? 'Desmarcar' : 'Completar'} ${esc(step.title)}" aria-pressed="${step.done}">${step.done ? '✓' : ''}</button><strong>${esc(step.title)}</strong>${logged ? `<span class="logged">${logged} min registrados</span>` : ''}</div><div class="step-options"><label>Fecha<input type="date" value="${esc(step.date)}" data-field="date" data-step="${esc(step.id)}"></label><label>Estimación<input type="number" min="5" max="600" step="5" value="${step.minutes}" data-field="minutes" data-step="${esc(step.id)}"></label>${!step.done ? `<button class="text-button" data-action="log" data-project="${esc(project.id)}" data-step="${esc(step.id)}">Registrar avance</button>` : ''}</div></div>`;
  }).join('')}</div><form id="add-step"><label>Agregar otro paso<input name="title" maxlength="160" required placeholder="Un siguiente paso concreto"></label><button class="secondary">＋ Agregar paso</button></form>`;
}

function fillPlanDialog(projectId, stepId, date = dayKey()) {
  const projects = state.projects.filter(project => project.steps.some(step => !step.done));
  $('#plan-project').innerHTML = projects.map(project => `<option value="${esc(project.id)}" ${project.id === projectId ? 'selected' : ''}>${esc(project.title)}</option>`).join('');
  const selectedProject = $('#plan-project').value;
  const steps = state.projects.find(project => project.id === selectedProject)?.steps.filter(step => !step.done) || [];
  $('#plan-step').innerHTML = steps.map(step => `<option value="${esc(step.id)}" ${step.id === stepId ? 'selected' : ''}>${esc(step.title)}</option>`).join('');
  const selected = findStep(selectedProject, $('#plan-step').value);
  $('#plan-form [name="date"]').value = date;
  $('#plan-form [name="minutes"]').value = selected?.minutes || 25;
}

function openProgress(projectId, stepId) {
  activeProject = projectId;
  activeStep = stepId;
  const project = state.projects.find(item => item.id === projectId);
  const step = findStep(projectId, stepId);
  $('#progress-step-label').innerHTML = `<strong>${esc(step.title)}</strong><br>${esc(project.title)}`;
  $('#progress-form').reset();
  $('#progress-form [name="minutes"]').value = Math.min(step.minutes, 25);
  $('#progress-form [name="date"]').value = dayKey();
  $('#progress-dialog').showModal();
}

function openReview() {
  reviewWeek = plannerWeek;
  const summary = weekSummary(state, reviewWeek);
  const existing = state.reviews.find(review => review.week === reviewWeek);
  $('#review-summary').innerHTML = `<div><strong>${summary.completed}/${summary.planned}</strong><span>pasos completados</span></div><div><strong>${summary.minutes}</strong><span>minutos registrados</span></div><div><strong>${summary.daysActive}</strong><span>días con avance</span></div>`;
  $('#review-form [name="wins"]').value = existing?.wins || '';
  $('#review-form [name="blockers"]').value = existing?.blockers || '';
  $('#review-form [name="nextFocus"]').value = existing?.nextFocus || '';
  $('#review-dialog').showModal();
}

document.addEventListener('click', event => {
  const close = event.target.closest('[data-close]');
  if (close) { $('#' + close.dataset.close).close(); return; }
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const { action, project, step } = button.dataset;
  if (action === 'new') { $('#project-dialog').showModal(); return; }
  if (action === 'week') { location.hash = 'semana'; return; }
  if (action === 'detail') { openDetail(project); return; }
  if (action === 'toggle') {
    state = toggleStep(state, project, step);
    save();
    if ($('#detail-dialog').open) drawDetail();
    toast('Progreso actualizado');
  }
  if (action === 'tomorrow') {
    findStep(project, step).date = tomorrow(); save(); toast('Movido a mañana');
  }
  if (action === 'log') { openProgress(project, step); }
  if (action === 'plan' || action === 'plan-date' || action === 'plan-step') {
    if (!state.projects.some(item => item.steps.some(candidate => !candidate.done))) { toast('Primero agregá un aprendizaje con pasos pendientes.'); return; }
    const suggestedDate = plannerWeek === weekStart() ? dayKey() : plannerWeek;
    fillPlanDialog(project, step, button.dataset.date || suggestedDate);
    $('#plan-dialog').showModal();
  }
  if (action === 'prev-week') { plannerWeek = addDays(plannerWeek, -7); render(); }
  if (action === 'next-week') { plannerWeek = addDays(plannerWeek, 7); render(); }
  if (action === 'current-week') { plannerWeek = weekStart(); render(); }
  if (action === 'review') openReview();
});

$('#plan-project').addEventListener('change', () => fillPlanDialog($('#plan-project').value, null, $('#plan-form [name="date"]').value));
$('#plan-step').addEventListener('change', () => { const step = findStep($('#plan-project').value, $('#plan-step').value); if (step) $('#plan-form [name="minutes"]').value = step.minutes; });

$('#plan-form').addEventListener('submit', event => {
  event.preventDefault();
  const data = new FormData(event.target);
  const step = findStep(data.get('project'), data.get('step'));
  if (!step) return;
  step.date = data.get('date');
  step.minutes = Number(data.get('minutes'));
  save();
  $('#plan-dialog').close();
  toast('Paso agregado a tu semana');
});

$('#progress-form').addEventListener('submit', event => {
  event.preventDefault();
  const data = new FormData(event.target);
  const minutes = Number(data.get('minutes'));
  state.sessions.push({ id: crypto.randomUUID(), projectId: activeProject, stepId: activeStep, date: data.get('date'), minutes, note: data.get('note').trim(), createdAt: new Date().toISOString() });
  const step = findStep(activeProject, activeStep);
  if (data.get('complete') && !step.done) { step.done = true; step.completedAt = new Date().toISOString(); }
  save();
  $('#progress-dialog').close();
  if ($('#detail-dialog').open) drawDetail();
  toast(data.get('complete') ? 'Avance guardado y paso completado' : 'Avance registrado');
});

$('#review-form').addEventListener('submit', event => {
  event.preventDefault();
  const data = new FormData(event.target);
  const review = { week: reviewWeek, wins: data.get('wins').trim(), blockers: data.get('blockers').trim(), nextFocus: data.get('nextFocus').trim(), updatedAt: new Date().toISOString() };
  const index = state.reviews.findIndex(item => item.week === reviewWeek);
  if (index >= 0) state.reviews[index] = review; else state.reviews.push(review);
  plannerWeek = addDays(reviewWeek, 7);
  save();
  $('#review-dialog').close();
  toast('Revisión guardada. Ya podés planificar la próxima semana.');
});

$('#detail-content').addEventListener('change', event => {
  const field = event.target.dataset.field;
  if (!field) return;
  if (!event.target.checkValidity()) { event.target.reportValidity(); return; }
  const step = findStep(activeProject, event.target.dataset.step);
  step[field] = field === 'minutes' ? Number(event.target.value) : event.target.value;
  save(); toast('Paso actualizado');
});

$('#detail-content').addEventListener('submit', event => {
  if (event.target.id !== 'add-step') return;
  event.preventDefault();
  const title = new FormData(event.target).get('title').trim();
  if (!title) return;
  state.projects.find(project => project.id === activeProject).steps.push({ id: crypto.randomUUID(), title, done: false, date: '', minutes: 25, completedAt: null });
  save(); drawDetail(); toast('Paso agregado');
});

$('#project-form').addEventListener('submit', event => {
  event.preventDefault();
  const data = new FormData(event.target);
  const title = data.get('title').trim();
  const goal = data.get('goal').trim();
  const steps = data.get('steps').split('\n').map(step => step.trim()).filter(Boolean);
  if (!title || !goal || !steps.length) { toast('Escribí un nombre, objetivo y al menos un paso.'); return; }
  const project = { id: crypto.randomUUID(), title, goal, type: data.get('type'), color: state.projects.length % 3, steps: steps.map(stepTitle => ({ id: crypto.randomUUID(), title: stepTitle, done: false, date: '', minutes: 25, completedAt: null })) };
  state.projects.push(project);
  save(); event.target.reset(); $('#project-dialog').close(); openDetail(project.id);
  toast('Aprendizaje creado. Elegí tu primer paso para hoy.');
});

$('#start-own').addEventListener('click', () => $('#reset-dialog').showModal());
$('#confirm-reset').addEventListener('click', () => { state = { version: 2, demo: false, projects: [], sessions: [], reviews: [] }; save(); $('#reset-dialog').close(); toast('Tu espacio está listo'); });
window.addEventListener('hashchange', render);
window.addEventListener('storage', event => {
  if (event.key !== storageKey || !event.newValue) return;
  try {
    const incoming = migrateState(JSON.parse(event.newValue));
    if (validState(incoming)) { state = incoming; render(); if ($('#detail-dialog').open) state.projects.some(project => project.id === activeProject) ? drawDetail() : $('#detail-dialog').close(); }
  } catch { /* Un cambio inválido de otra pestaña se ignora. */ }
});

render();

if (document.modelContext?.registerTool) {
  const lifecycle = new AbortController();
  try {
    Promise.resolve(document.modelContext.registerTool({
      name: 'read_learning_progress', title: 'Consultar mis aprendizajes', description: 'Consulta los aprendizajes, la planificación semanal y los avances de este navegador, sin modificar datos.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute(input) {
        if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length) throw new Error('Se espera un objeto vacío.');
        return { demo: state.demo, week: weekSummary(state, weekStart()), projects: state.projects.map(project => ({ id: project.id, title: project.title, progress: progress(project), steps: project.steps.map(step => ({ title: step.title, done: step.done, date: step.date })) })) };
      }
    }, { signal: lifecycle.signal })).catch(() => {});
    window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
  } catch { /* La interfaz funciona también sin esta API experimental. */ }
}
