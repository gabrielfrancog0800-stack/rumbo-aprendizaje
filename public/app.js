import './cloud.js';
import { addDays, dateFromKey, dayKey, demoState, migrateState, progress, toggleStep, tomorrow, validState, weekDays, weekStart, weekSummary } from './model.js';

const $ = selector => document.querySelector(selector);
const esc = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const icon = name => {
  const paths = {
    course: '<path d="M6 4.5h9.5A2.5 2.5 0 0 1 18 7v12.5H8.5A2.5 2.5 0 0 1 6 17V4.5Z"/><path d="M6 17c0-1.4 1.1-2.5 2.5-2.5H18M9.5 8h5"/>',
    skill: '<path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3Z"/><path d="m18.5 16 .7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7.7-2.3Z"/>',
    project: '<rect x="4" y="5" width="16" height="14" rx="3"/><path d="M8 9h8M8 13h5"/>',
    arrow: '<path d="M7 17 17 7M8 7h9v9"/>',
    check: '<path d="m6 12 4 4 8-9"/>'
  };
  return `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || ''}</svg>`;
};
const storageKey = 'rumbo.state.v1';
const scopedStorageKey = workspaceId => `${storageKey}.${workspaceId || 'anonymous'}`;
const shortDate = key => new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' }).format(dateFromKey(key));
const weekday = key => new Intl.DateTimeFormat('es', { weekday: 'short' }).format(dateFromKey(key)).replace('.', '');
let state;
let storageBlocked = false;
let activeProject = null;
let activeStep = null;
let plannerWeek = weekStart();
let reviewWeek = plannerWeek;
let toastTimer;
let searchQuery = '';
let cloudInfo = { configured: false, authenticated: false, role: null, email: '', workspace: null };
let syncState = 'local';
let activeStorageKey = storageKey;
let authTransition = false;

const isReadOnly = () => cloudInfo.role === 'viewer';
const editableButton = html => isReadOnly() ? '' : html;

try {
  const saved = localStorage.getItem(activeStorageKey);
  const migrated = saved ? migrateState(JSON.parse(saved)) : demoState();
  if (!validState(migrated)) throw new Error('invalid');
  state = migrated;
  if (saved && JSON.parse(saved).version === 1) localStorage.setItem(activeStorageKey, JSON.stringify(state));
} catch {
  state = demoState();
  storageBlocked = true;
  $('#storage-warning').hidden = false;
  $('#storage-warning').textContent = 'No pudimos leer los datos guardados. Esta sesión es temporal; no se sobrescribirán los datos anteriores.';
}

function save() {
  if (!storageBlocked) {
    try { localStorage.setItem(activeStorageKey, JSON.stringify(state)); }
    catch {
      $('#storage-warning').hidden = false;
      $('#storage-warning').textContent = 'No se pudieron guardar los cambios. Permanecerán solo durante esta sesión.';
    }
  }
  if (cloudInfo.role === 'owner') {
    const pendingKey = `rumbo.pending.${cloudInfo.workspace.id}`;
    localStorage.setItem(pendingKey, String(Date.now()));
    syncState = 'saving';
    updateCloudUi();
    window.RumboCloud.scheduleSave(state, () => {
      localStorage.removeItem(pendingKey);
      syncState = 'synced';
      updateCloudUi();
    }, () => {
      syncState = 'error';
      updateCloudUi();
      toast('No se pudo sincronizar. Tus cambios siguen guardados en este dispositivo.');
    });
  }
  render();
}

function toast(message) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 3500);
}

function resetToAnonymous() {
  activeStorageKey = scopedStorageKey();
  state = demoState();
  if (!storageBlocked) localStorage.setItem(activeStorageKey, JSON.stringify(state));
  cloudInfo = { configured: true, authenticated: false, role: null, email: '', workspace: null };
  syncState = 'local';
  render();
}

function allSteps() {
  return state.projects.flatMap(project => project.steps.map(step => ({ ...step, project })));
}

function findStep(projectId, stepId) {
  return state.projects.find(project => project.id === projectId)?.steps.find(step => step.id === stepId);
}

function pageHeading(_eyebrow, title, subtitle, action = '<button class="primary" data-action="new">Nuevo aprendizaje</button>') {
  return `<div class="page-heading"><div><h1>${title}</h1><p>${subtitle}</p></div>${editableButton(action)}</div>`;
}

function taskRow(step, project, compact = false) {
  return `<article class="task ${step.done ? 'done' : ''} ${compact ? 'compact' : ''}">
    ${isReadOnly() ? `<span class="check readonly-check" aria-label="${step.done ? 'Completado' : 'Pendiente'}">${step.done ? icon('check') : ''}</span>` : `<button class="check" data-action="toggle" data-project="${esc(project.id)}" data-step="${esc(step.id)}" aria-label="${step.done ? 'Desmarcar' : 'Completar'} ${esc(step.title)}" aria-pressed="${step.done}">${step.done ? icon('check') : ''}</button>`}
    <div class="task-text"><span class="task-project">${esc(project.title)} ${step.date < dayKey() && !step.done ? '<span class="overdue">· Pendiente anterior</span>' : ''}</span><strong>${esc(step.title)}</strong></div>
    <span class="minutes">${step.minutes} min</span>
    ${!step.done && !isReadOnly() ? `<button class="log-button" data-action="log" data-project="${esc(project.id)}" data-step="${esc(step.id)}">Registrar avance</button>` : ''}
    ${!compact && !step.done && !isReadOnly() ? `<button class="defer" data-action="tomorrow" data-project="${esc(project.id)}" data-step="${esc(step.id)}" title="Mover a mañana">Mañana</button>` : ''}
  </article>`;
}

function projectCard(project) {
  const done = project.steps.filter(step => step.done).length;
  const percent = progress(project);
  const next = project.steps.find(step => !step.done);
  const projectIcon = project.type === 'Curso' ? 'course' : project.type === 'Habilidad' ? 'skill' : 'project';
  return `<button class="project-card color-${project.color % 3}" data-action="detail" data-project="${esc(project.id)}"><div class="card-top"><span class="project-icon">${icon(projectIcon)}</span><span class="type">${project.type}</span><span class="card-arrow">${icon('arrow')}</span></div><h3>${esc(project.title)}</h3><p class="goal">${esc(project.goal)}</p><div class="progress-label"><span>${done} de ${project.steps.length} pasos</span><strong>${percent}%</strong></div><progress value="${percent}" max="100" aria-label="Progreso de ${esc(project.title)}">${percent}%</progress><div class="card-next">${next ? `<small>SIGUIENTE PASO</small><span>${esc(next.title)}</span>` : '<span>Todos los pasos completados</span>'}</div></button>`;
}

function emptyState(title, copy, action, label) {
  return `<div class="empty"><h3>${title}</h3><p>${copy}</p><button class="secondary" data-action="${action}">${label}</button></div>`;
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

function renderSearch() {
  const query = searchQuery.trim().toLocaleLowerCase('es');
  const projects = state.projects.filter(project => `${project.title} ${project.goal} ${project.type}`.toLocaleLowerCase('es').includes(query));
  const steps = allSteps().filter(step => `${step.title} ${step.project.title}`.toLocaleLowerCase('es').includes(query));
  return pageHeading('', `Resultados para “${esc(searchQuery.trim())}”`, `${projects.length + steps.length} coincidencias`) + `<section class="search-results"><div><h2>Aprendizajes</h2><div class="project-grid">${projects.map(projectCard).join('') || '<p class="muted-copy">No encontramos aprendizajes con ese texto.</p>'}</div></div><div><h2>Pasos</h2><div class="task-list">${steps.slice(0, 50).map(step => taskRow(step, step.project, true)).join('') || '<p class="muted-copy">No encontramos pasos con ese texto.</p>'}</div></div></section>`;
}

function renderShare() {
  if (!cloudInfo.configured) return pageHeading('', 'Compartir avances', 'La sincronización estará disponible cuando conectemos el almacenamiento del sitio.', '') + `<section class="cloud-panel"><div class="cloud-visual indigo"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v16m-5-5 5 5 5-5M5 9V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3"/></svg></div><div><h2>Preparando la nube</h2><p>Podés seguir usando Rumbo en este dispositivo. Tus datos locales no se perderán al conectar tu cuenta.</p></div></section>`;
  if (!cloudInfo.authenticated) return pageHeading('', 'Compartir avances', 'Iniciá sesión para sincronizar tus datos y dar acceso de solo lectura.', '<button class="primary" data-action="account">Crear cuenta o entrar</button>') + `<section class="share-grid"><article><span class="status-badge info">SINCRONIZACIÓN</span><h2>Tus avances en todos tus dispositivos</h2><p>La primera vez que entrés, Rumbo subirá de forma segura los datos guardados en este navegador.</p></article><article><span class="status-badge success">SOLO LECTURA</span><h2>Una vista clara para tu familia</h2><p>Tu familiar verá proyectos, progreso y planificación. Tus notas personales y obstáculos seguirán siendo privados.</p><button class="secondary" data-action="join">Ya tengo un código</button></article></section>`;
  if (cloudInfo.role === 'viewer') return pageHeading('', 'Avances compartidos', `Estás viendo el espacio “${esc(cloudInfo.workspace?.name || 'Mi aprendizaje')}”.`, '') + `<section class="readonly-banner"><span class="status-badge info">SOLO LECTURA</span><div><h2>Vista familiar activa</h2><p>Podés consultar el progreso y la planificación. Las notas privadas y los controles de edición no están disponibles.</p></div></section>`;
  return pageHeading('', 'Compartir avances', 'Invitá a tu papá u otro familiar con acceso de solo lectura.', '') + `<section class="invite-panel"><div><span class="status-badge success">ESPACIO SINCRONIZADO</span><h2>Tu código de invitación</h2><p>Compartí este código con la persona que querés invitar. Necesitará crear su propia cuenta.</p><div class="invite-code"><strong>${esc(cloudInfo.workspace?.share_code || '')}</strong><button class="primary" data-action="copy-code">Copiar código</button></div><button class="text-button" data-action="renew-code">Generar un código nuevo</button></div><aside><h3>Lo que verá</h3><ul><li>Progreso de cursos y proyectos</li><li>Pasos completados y pendientes</li><li>Planificación semanal</li><li>Tiempo total registrado</li></ul><h3>Siempre privado</h3><ul class="private-list"><li>Notas de cada sesión</li><li>Obstáculos de la revisión</li><li>Controles para editar</li></ul></aside></section>`;
}

function plannerTask(step, project) {
  return `<article class="planner-task color-${project.color % 3} ${step.done ? 'done' : ''}" data-project="${esc(project.id)}" data-step="${esc(step.id)}"><div><small>${esc(project.title)}</small><strong>${esc(step.title)}</strong></div><div class="planner-actions"><span>${step.minutes} min</span>${!step.done && !isReadOnly() ? `<button data-action="log" data-project="${esc(project.id)}" data-step="${esc(step.id)}" aria-label="Registrar avance">+</button>` : step.done ? `<span class="completed-mark">${icon('check')}</span>` : '<span class="pending-mark">Pendiente</span>'}</div></article>`;
}

function renderWeek() {
  const days = weekDays(plannerWeek);
  const summary = weekSummary(state, plannerWeek);
  const isCurrent = plannerWeek === weekStart();
  const end = days[6];
  const review = state.reviews.find(item => item.week === plannerWeek);
  const headerAction = '<button class="primary" data-action="plan">Planificar paso</button>';
  const navigation = `<div class="week-toolbar"><div class="week-nav"><button class="icon-button" data-action="prev-week" aria-label="Semana anterior">←</button><button class="secondary" data-action="current-week">Esta semana</button><button class="icon-button" data-action="next-week" aria-label="Semana siguiente">→</button></div><strong>${shortDate(plannerWeek)} – ${shortDate(end)}</strong></div>`;
  const stats = `<div class="stats week-stats"><div><span>Pasos planificados</span><strong>${summary.planned}<small>esta semana</small></strong></div><div><span>Completados</span><strong>${summary.completed}<small>de ${summary.planned}</small></strong></div><div><span>Tiempo registrado</span><strong>${summary.minutes}<small>minutos</small></strong></div></div>`;
  const board = `<p class="week-scroll-hint">Deslizá para recorrer la semana →</p><div class="week-board">${days.map(key => {
    const tasks = allSteps().filter(step => step.date === key);
    const isToday = key === dayKey();
    return `<section class="day-column ${isToday ? 'is-today' : ''}"><header><span>${weekday(key)}</span><strong>${dateFromKey(key).getDate()}</strong>${isToday ? '<small>HOY</small>' : ''}</header><div class="day-tasks">${tasks.map(step => plannerTask(step, step.project)).join('') || (isReadOnly() ? '<span class="no-plan">Sin actividad</span>' : '<button class="day-empty" data-action="plan-date" data-date="' + key + '">Agregar paso</button>')}</div><div class="day-total">${tasks.reduce((sum, step) => sum + step.minutes, 0)} min</div></section>`;
  }).join('')}</div>`;
  const backlog = allSteps().filter(step => !step.done && (!step.date || step.date < plannerWeek || step.date > end));
  const reviewCard = isReadOnly() ? '' : `<section class="review-card ${review ? 'reviewed' : ''}"><div><span class="review-icon">${review ? '✓' : 'R'}</span><div><h2>${review ? 'Revisión guardada' : 'Cerrá la semana con claridad'}</h2><p>${review ? `Próxima prioridad: ${esc(review.nextFocus || 'Aún no definida')}` : 'Revisá qué avanzaste y elegí una prioridad para la próxima semana.'}</p></div></div><button class="${review ? 'secondary' : 'primary'}" data-action="review">${review ? 'Editar revisión' : 'Hacer revisión semanal'}</button></section>`;
  const backlogHtml = isReadOnly() ? '' : `<section class="backlog"><div class="section-heading"><h2>Pasos sin planificar <span class="count">${backlog.length}</span></h2><span>Elegí solo lo que realmente podés hacer</span></div><div class="backlog-list">${backlog.slice(0, 8).map(step => `<button data-action="plan-step" data-project="${esc(step.project.id)}" data-step="${esc(step.id)}"><span><small>${esc(step.project.title)}</small><strong>${esc(step.title)}</strong></span><span>Planificar</span></button>`).join('') || '<p>Todo lo pendiente ya tiene un lugar.</p>'}</div></section>`;
  return pageHeading(isCurrent ? 'TU SEMANA' : 'PLANIFICACIÓN', 'Mi semana', 'Decidí qué vas a hacer y protegé tiempo para hacerlo.', headerAction) + navigation + stats + board + reviewCard + backlogHtml;
}

function render() {
  const route = location.hash === '#panel' ? 'panel' : location.hash === '#semana' ? 'semana' : location.hash === '#compartir' ? 'compartir' : 'hoy';
  document.querySelectorAll('[data-nav]').forEach(link => {
    const active = link.dataset.nav === route;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
  $('#date-label').textContent = new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  $('#demo-banner').hidden = !state.demo;
  $('#view').innerHTML = searchQuery.trim() ? renderSearch() : route === 'panel' ? renderPanel() : route === 'semana' ? renderWeek() : route === 'compartir' ? renderShare() : renderToday();
  if (!searchQuery.trim() && route === 'semana' && plannerWeek === weekStart()) requestAnimationFrame(() => {
    const board = $('.week-board');
    const today = board?.querySelector('.is-today');
    if (board && today && matchMedia('(max-width: 780px)').matches) board.scrollLeft = Math.max(0, today.offsetLeft - board.offsetLeft - 8);
  });
  updateCloudUi();
}

function openDetail(id) {
  activeProject = id;
  drawDetail();
  if (!$('#detail-dialog').open) $('#detail-dialog').showModal();
}

function drawDetail() {
  const project = state.projects.find(item => item.id === activeProject);
  if (!project) return;
  $('#detail-content').innerHTML = `<div class="dialog-heading"><span class="type">${project.type}</span><button class="icon-button" data-close="detail-dialog" aria-label="Cerrar">×</button></div><h2 id="detail-title">${esc(project.title)}</h2><p>${esc(project.goal)}</p>${isReadOnly() ? '<span class="status-badge info">SOLO LECTURA</span>' : ''}<div class="progress-label"><span>Tu recorrido</span><strong>${progress(project)}%</strong></div><progress value="${progress(project)}" max="100" aria-label="Progreso">${progress(project)}%</progress><div class="detail-steps">${project.steps.map(step => {
    const logged = state.sessions.filter(session => session.stepId === step.id).reduce((sum, session) => sum + session.minutes, 0);
    return `<div class="detail-step"><div class="step-heading">${isReadOnly() ? `<span class="check readonly-check" aria-label="${step.done ? 'Completado' : 'Pendiente'}">${step.done ? icon('check') : ''}</span>` : `<button class="check ${step.done ? 'checked' : ''}" data-action="toggle" data-project="${esc(project.id)}" data-step="${esc(step.id)}" aria-label="${step.done ? 'Desmarcar' : 'Completar'} ${esc(step.title)}" aria-pressed="${step.done}">${step.done ? icon('check') : ''}</button>`}<strong>${esc(step.title)}</strong>${logged ? `<span class="logged">${logged} min registrados</span>` : ''}</div>${isReadOnly() ? `<div class="step-readonly-meta">${step.date ? shortDate(step.date) : 'Sin fecha'} · ${step.minutes} min</div>` : `<div class="step-options"><label>Fecha<input type="date" value="${esc(step.date)}" data-field="date" data-step="${esc(step.id)}"></label><label>Estimación<input type="number" min="5" max="600" step="5" value="${step.minutes}" data-field="minutes" data-step="${esc(step.id)}"></label>${!step.done ? `<button class="text-button" data-action="log" data-project="${esc(project.id)}" data-step="${esc(step.id)}">Registrar avance</button>` : ''}</div>`}</div>`;
  }).join('')}</div>${isReadOnly() ? '' : '<form id="add-step"><label>Agregar otro paso<input name="title" maxlength="160" required placeholder="Un siguiente paso concreto"></label><button class="secondary">Agregar paso</button></form>'}`;
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

function updateCloudUi() {
  const status = $('#sync-status');
  const label = $('#cloud-label');
  const profileName = $('#profile-name');
  const avatar = $('#profile-avatar');
  if (!status) return;
  status.className = `sync-pill ${syncState}`;
  if (!cloudInfo.configured) {
    status.querySelector('strong').textContent = 'Guardado local';
    status.setAttribute('aria-label', 'Abrir cuenta: guardado local');
    label.textContent = 'Solo en este dispositivo';
    return;
  }
  if (!cloudInfo.authenticated) {
    status.querySelector('strong').textContent = 'Conectar cuenta';
    status.setAttribute('aria-label', 'Abrir cuenta: conectar cuenta');
    label.textContent = 'Sin sincronizar';
    return;
  }
  const messages = { saving: 'Sincronizando…', error: 'Revisar conexión', synced: 'Sincronizado', local: 'Conectado' };
  status.querySelector('strong').textContent = isReadOnly() ? 'Vista familiar' : messages[syncState] || 'Sincronizado';
  status.setAttribute('aria-label', isReadOnly() ? 'Abrir cuenta: vista familiar de solo lectura' : `Abrir cuenta: ${messages[syncState] || 'Sincronizado'}`);
  label.textContent = isReadOnly() ? 'Acceso de solo lectura' : 'Guardado en la nube';
  profileName.textContent = cloudInfo.email?.split('@')[0] || 'Mi cuenta';
  avatar.textContent = (cloudInfo.email?.[0] || 'T').toUpperCase();
}

function renderAccountContent(message = '', email = '') {
  const container = $('#account-content');
  if (!cloudInfo.configured) {
    container.innerHTML = '<div class="account-state"><span class="status-badge info">PRÓXIMAMENTE</span><h3>Sincronización en preparación</h3><p>Podés seguir usando Rumbo normalmente. Tus datos están guardados en este dispositivo.</p></div>';
    return;
  }
  if (!cloudInfo.authenticated) {
    container.innerHTML = `${message ? `<div class="inline-message">${esc(message)}</div>` : ''}<form id="auth-form"><label>Correo electrónico<input type="email" name="email" autocomplete="email" maxlength="254" required placeholder="tu@correo.com" value="${esc(email)}"></label><label>Contraseña<input type="password" name="password" autocomplete="current-password" minlength="8" maxlength="72" required placeholder="Mínimo 8 caracteres"></label><div class="dialog-actions split"><button class="secondary" type="submit" value="signup">Crear cuenta</button><button class="primary" type="submit" value="signin">Entrar</button></div><p class="help">Al entrar por primera vez, tus datos actuales se sincronizarán con tu cuenta.</p></form>`;
    return;
  }
  container.innerHTML = `<div class="account-state"><span class="status-badge ${isReadOnly() ? 'info' : 'success'}">${isReadOnly() ? 'FAMILIAR' : 'PROPIETARIO'}</span><h3>${esc(cloudInfo.email)}</h3><p>${isReadOnly() ? 'Podés consultar el progreso compartido, sin editarlo.' : 'Tus cambios se guardan en la nube y se mantienen sincronizados.'}</p><button class="secondary" data-action="signout">Cerrar sesión</button>${isReadOnly() ? '<button class="text-button" data-action="switch-owner">Volver a mi espacio</button>' : '<button class="text-button" data-action="join">Usar un código de invitación</button>'}</div>`;
}

function applyCloudWorkspace(result) {
  const workspaceStorageKey = scopedStorageKey(result.workspace.id);
  const pendingKey = `rumbo.pending.${result.workspace.id}`;
  let candidate = result.state;
  if (localStorage.getItem(pendingKey)) {
    try {
      const localCandidate = migrateState(JSON.parse(localStorage.getItem(workspaceStorageKey)));
      if (validState(localCandidate)) candidate = localCandidate;
    } catch { /* The validated cloud copy remains the fallback. */ }
  }
  const incoming = migrateState(candidate);
  if (incoming && validState(incoming)) state = incoming;
  activeStorageKey = workspaceStorageKey;
  cloudInfo = { configured: true, authenticated: true, role: result.role, email: result.email, workspace: result.workspace };
  syncState = localStorage.getItem(pendingKey) && result.role === 'owner' ? 'saving' : 'synced';
  if (!storageBlocked) localStorage.setItem(activeStorageKey, JSON.stringify(state));
  if (syncState === 'saving') save(); else render();
}

async function loadCloudWorkspace() {
  const result = await window.RumboCloud.bootstrap(state);
  if (!result) return;
  applyCloudWorkspace(result);
}

async function initializeCloud() {
  try {
    const result = await window.RumboCloud.init(async (next, event) => {
      if (authTransition) return;
      if (!next && cloudInfo.authenticated) {
        resetToAnonymous();
        toast('La sesión se cerró en este dispositivo.');
      } else if (next && !cloudInfo.authenticated && event === 'SIGNED_IN') {
        cloudInfo.authenticated = true;
        await loadCloudWorkspace();
      }
    });
    cloudInfo.configured = result.configured;
    cloudInfo.authenticated = Boolean(result.session);
    updateCloudUi();
    if (result.session) await loadCloudWorkspace();
  } catch {
    cloudInfo.configured = true;
    syncState = 'error';
    updateCloudUi();
    toast('No pudimos conectar con la nube. Podés continuar usando tus datos locales.');
  }
}

document.addEventListener('click', event => {
  const close = event.target.closest('[data-close]');
  if (close) { $('#' + close.dataset.close).close(); return; }
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const { action, project, step } = button.dataset;
  const writeActions = ['new', 'toggle', 'tomorrow', 'log', 'plan', 'plan-date', 'plan-step', 'review', 'renew-code'];
  if (isReadOnly() && writeActions.includes(action)) { toast('Este acceso es de solo lectura.'); return; }
  if (action === 'account') { renderAccountContent(); $('#account-dialog').showModal(); return; }
  if (action === 'join') { $('#account-dialog').close(); $('#join-dialog').showModal(); return; }
  if (action === 'signout') {
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    authTransition = true;
    window.RumboCloud.signOut().then(() => { $('#account-dialog').close(); resetToAnonymous(); toast('Sesión cerrada'); }).catch(() => { button.disabled = false; button.removeAttribute('aria-busy'); toast('No pudimos cerrar la sesión. Intentá de nuevo.'); }).finally(() => { authTransition = false; });
    return;
  }
  if (action === 'switch-owner') {
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    window.RumboCloud.switchToOwned(state).then(result => {
      applyCloudWorkspace(result);
      $('#account-dialog').close();
      toast('Volviste a tu espacio personal');
    }).catch(() => { button.disabled = false; button.removeAttribute('aria-busy'); toast('No pudimos abrir tu espacio personal.'); });
    return;
  }
  if (action === 'copy-code') {
    navigator.clipboard?.writeText(cloudInfo.workspace.share_code).then(() => toast('Código copiado')).catch(() => toast(`Código: ${cloudInfo.workspace.share_code}`));
    return;
  }
  if (action === 'renew-code') {
    button.disabled = true;
    window.RumboCloud.renewCode().then(workspace => { cloudInfo.workspace = workspace; render(); toast('Código renovado. El anterior dejó de funcionar.'); }).catch(() => { button.disabled = false; toast('No pudimos renovar el código. Intentá de nuevo.'); });
    return;
  }
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

$('#account-content').addEventListener('submit', async event => {
  if (event.target.id !== 'auth-form') return;
  event.preventDefault();
  const submitter = event.submitter;
  const data = new FormData(event.target);
  const email = data.get('email').trim();
  const buttons = event.target.querySelectorAll('button');
  buttons.forEach(button => { button.disabled = true; });
  event.target.setAttribute('aria-busy', 'true');
  authTransition = true;
  try {
    if (submitter.value === 'signup') {
      const result = await window.RumboCloud.signUp(email, data.get('password'));
      if (result.needsConfirmation) { renderAccountContent('Revisá tu correo y confirmá la cuenta. Después podrás entrar.', email); return; }
    } else await window.RumboCloud.signIn(email, data.get('password'));
    await loadCloudWorkspace();
    $('#account-dialog').close();
    toast('Tu cuenta está conectada');
  } catch (error) {
    renderAccountContent(error.message.includes('Invalid login') ? 'El correo o la contraseña no coinciden.' : 'No pudimos completar el acceso. Revisá los datos e intentá de nuevo.', email);
  } finally {
    authTransition = false;
  }
});

$('#join-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!cloudInfo.authenticated) { $('#join-dialog').close(); renderAccountContent('Primero iniciá sesión y luego ingresá el código.'); $('#account-dialog').showModal(); return; }
  const button = event.target.querySelector('button[type="submit"]');
  button.disabled = true;
  event.target.setAttribute('aria-busy', 'true');
  try {
    const result = await window.RumboCloud.join(new FormData(event.target).get('code'), state);
    applyCloudWorkspace(result);
    $('#join-dialog').close(); event.target.reset(); location.hash = 'hoy'; render(); toast('Ya podés ver los avances compartidos');
  } catch {
    button.disabled = false;
    event.target.removeAttribute('aria-busy');
    toast('El código no es válido o ya no está activo.');
  }
});

$('#global-search').addEventListener('input', event => { searchQuery = event.target.value; render(); });

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
initializeCloud();

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
