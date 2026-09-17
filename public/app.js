import './cloud.js';
import { collaboratorSummary, dayKey, demoState, migrateState, progress, toggleStep, tomorrow, validState, weekStart, weekSummary } from './model.js';

const $ = selector => document.querySelector(selector);
const esc = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const icons = {
  course: '<path d="M6 4.5h9.5A2.5 2.5 0 0 1 18 7v12.5H8.5A2.5 2.5 0 0 1 6 17V4.5Z"/><path d="M6 17c0-1.4 1.1-2.5 2.5-2.5H18M9.5 8h5"/>',
  skill: '<path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3Z"/>',
  project: '<rect x="4" y="5" width="16" height="14" rx="3"/><path d="M8 9h8M8 13h5"/>',
  check: '<path d="m6 12 4 4 8-9"/>'
};
const icon = name => `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name] || ''}</svg>`;
const storageKey = 'rumbo.state.v1';
const scopedStorageKey = workspaceId => workspaceId ? `${storageKey}.${workspaceId}` : storageKey;

let activeStorageKey = storageKey;
let activeProject = null;
let activeStep = null;
let adminPerson = null;
let authTransition = false;
let storageBlocked = false;
let syncState = 'local';
let toastTimer;
let cloudInfo = { configured: false, authenticated: false, role: null, email: '', workspace: null, profile: null, team: null, people: [] };
let state;

try {
  const saved = localStorage.getItem(activeStorageKey);
  state = saved ? migrateState(JSON.parse(saved)) : demoState();
  if (!validState(state)) throw new Error('invalid');
} catch {
  state = demoState();
  storageBlocked = true;
  $('#storage-warning').hidden = false;
  $('#storage-warning').textContent = 'No pudimos leer los datos guardados. Esta sesión será temporal.';
}

const isReadOnly = () => cloudInfo.role === 'admin';
const allSteps = () => state.projects.flatMap(project => project.steps.map(step => ({ ...step, project })));
const findStep = (projectId, stepId) => state.projects.find(project => project.id === projectId)?.steps.find(step => step.id === stepId);

function toast(message) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 3200);
}

function save() {
  if (!storageBlocked) {
    try { localStorage.setItem(activeStorageKey, JSON.stringify(state)); }
    catch { toast('No pudimos guardar los cambios en este dispositivo.'); }
  }
  if (cloudInfo.role === 'collaborator') {
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
      toast('Tus cambios están guardados aquí, pero no se pudieron sincronizar.');
    });
  }
  render();
}

function pageHeading(title, subtitle, action = '') {
  return `<header class="page-heading"><div><h1>${title}</h1><p>${subtitle}</p></div>${isReadOnly() ? '' : action}</header>`;
}

function emptyState(title, copy, action = '', label = '') {
  return `<div class="empty"><h2>${title}</h2><p>${copy}</p>${action ? `<button class="secondary" data-action="${action}">${label}</button>` : ''}</div>`;
}

function taskRow(step, project) {
  return `<article class="task ${step.done ? 'done' : ''}">
    ${isReadOnly() ? `<span class="check readonly-check">${step.done ? icon('check') : ''}</span>` : `<button class="check" data-action="toggle" data-project="${esc(project.id)}" data-step="${esc(step.id)}" aria-label="${step.done ? 'Desmarcar' : 'Completar'} ${esc(step.title)}">${step.done ? icon('check') : ''}</button>`}
    <div class="task-text"><small>${esc(project.title)}</small><strong>${esc(step.title)}</strong></div>
    <span class="minutes">${step.minutes} min</span>
    ${!step.done && !isReadOnly() ? `<div class="task-actions"><button data-action="log" data-project="${esc(project.id)}" data-step="${esc(step.id)}">Registrar</button><button data-action="tomorrow" data-project="${esc(project.id)}" data-step="${esc(step.id)}">Mañana</button></div>` : ''}
  </article>`;
}

function projectRow(project) {
  const percent = progress(project);
  const next = project.steps.find(step => !step.done);
  const typeIcon = project.type === 'Curso' ? 'course' : project.type === 'Habilidad' ? 'skill' : 'project';
  return `<button class="project-row" data-action="detail" data-project="${esc(project.id)}">
    <span class="project-icon">${icon(typeIcon)}</span>
    <span class="project-copy"><strong>${esc(project.title)}</strong>${project.goal ? `<small>${esc(project.goal)}</small>` : ''}${next ? `<span>Siguiente: ${esc(next.title)}</span>` : '<span>Completado</span>'}</span>
    <span class="project-progress"><strong>${percent}%</strong><progress value="${percent}" max="100" aria-label="Progreso de ${esc(project.title)}"></progress></span>
  </button>`;
}

function renderToday() {
  const today = dayKey();
  const tasks = allSteps().filter(step => step.date && step.date <= today && !step.done);
  const minutes = tasks.reduce((total, step) => total + step.minutes, 0);
  const date = new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  const action = state.demo ? '<button class="primary" data-action="start-own">Empezar con mis datos</button>' : '<button class="primary" data-action="new">Nuevo aprendizaje</button>';
  const list = tasks.map(step => taskRow(step, step.project)).join('') || emptyState('Tu día está libre', state.projects.length ? 'Abrí un aprendizaje y asigná una fecha a su siguiente paso.' : 'Creá tu primer aprendizaje y definí un paso pequeño.', state.projects.length ? '' : 'new', 'Crear aprendizaje');
  return pageHeading('Hoy', date, action) + `<section class="focus"><div class="section-heading"><div><h2>Tu siguiente paso</h2><p>${tasks.length} pendientes · ${minutes} min</p></div></div><div class="task-list">${list}</div><a class="more-link" href="#panel">Ver todos mis aprendizajes</a></section>`;
}

function renderPanel() {
  const action = '<button class="primary" data-action="new">Nuevo aprendizaje</button>';
  return pageHeading('Aprendizajes', 'Todo tu progreso, sin distracciones.', action) + `<section class="learning-list">${state.projects.map(projectRow).join('') || emptyState('Empezá con algo concreto', 'Puede ser un curso, una habilidad o un proyecto.', 'new', 'Crear aprendizaje')}</section>`;
}

function personSummary(person) {
  const personState = person.data && validState(person.data) ? person.data : { version: 2, demo: false, projects: [], sessions: [], reviews: [] };
  return { state: personState, ...collaboratorSummary(personState) };
}

function renderTeam() {
  if (!cloudInfo.authenticated) return pageHeading('Equipo', 'Iniciá sesión para acceder.', '<button class="primary" data-action="account">Entrar</button>');
  if (cloudInfo.role !== 'admin') return pageHeading('Cuenta', cloudInfo.team ? `Conectado con ${esc(cloudInfo.team.name)}.` : 'Todavía no pertenecés a un equipo.');
  if (adminPerson) {
    const summary = personSummary(adminPerson);
    state = summary.state;
    return pageHeading(esc(adminPerson.full_name || adminPerson.email), esc(adminPerson.position || 'Colaborador'), '<button class="secondary" data-action="admin-back">Volver</button>') +
      `<div class="summary-strip"><span><strong>${summary.active}</strong> activos</span><span><strong>${summary.done}/${summary.total}</strong> pasos</span><span><strong>${summary.week.completed}/${summary.week.planned}</strong> esta semana</span></div>` +
      `<section class="learning-list">${state.projects.map(projectRow).join('') || emptyState('Sin actividad todavía', 'Cuando registre avances aparecerán aquí.')}</section>`;
  }
  const people = cloudInfo.people.map(person => {
    const summary = personSummary(person);
    const percent = summary.total ? Math.round(summary.done / summary.total * 100) : 0;
    return `<button class="person-row" data-action="admin-person" data-user="${esc(person.user_id)}"><span class="person-avatar">${esc((person.full_name || person.email || '?')[0].toUpperCase())}</span><span><strong>${esc(person.full_name || person.email)}</strong><small>${esc(person.position || 'Sin puesto')}</small><span>${summary.active} activos · ${summary.week.completed}/${summary.week.planned} esta semana</span></span><strong>${percent}%</strong></button>`;
  }).join('');
  return pageHeading(cloudInfo.team?.name || 'Equipo', `${cloudInfo.people.length} colaboradores`, '<button class="primary" data-action="team-invite">Invitar</button>') + `<section class="people-list">${people || emptyState('Tu equipo está vacío', 'Invitá al primer colaborador con un enlace privado.')}</section>`;
}

function render() {
  const admin = cloudInfo.role === 'admin';
  document.querySelectorAll('[data-collaborator]').forEach(element => { element.hidden = admin; });
  document.querySelectorAll('[data-admin]').forEach(element => { element.hidden = !admin; });
  const route = admin ? 'equipo' : location.hash === '#panel' ? 'panel' : 'hoy';
  document.querySelectorAll('[data-nav]').forEach(link => {
    const active = link.dataset.nav === route;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
  $('#view').innerHTML = route === 'equipo' ? renderTeam() : route === 'panel' ? renderPanel() : renderToday();
  updateCloudUi();
}

function openNewLearning() {
  activeProject = null;
  $('#detail-content').innerHTML = `<form id="project-form"><div class="dialog-heading"><h2 id="detail-title">Nuevo aprendizaje</h2><button type="button" data-close="detail-dialog" class="icon-button" aria-label="Cerrar">×</button></div><label>Nombre<input name="title" maxlength="100" required autofocus placeholder="Ej. Excel para finanzas"></label><label>Tipo<select name="type"><option>Curso</option><option>Habilidad</option><option>Proyecto</option></select></label><label>Primer paso<input name="step" maxlength="160" required placeholder="Una acción pequeña y concreta"></label><button class="primary" type="submit">Crear</button></form>`;
  $('#detail-dialog').showModal();
}

function openDetail(id) {
  activeProject = id;
  drawDetail();
  if (!$('#detail-dialog').open) $('#detail-dialog').showModal();
}

function drawDetail() {
  const project = state.projects.find(item => item.id === activeProject);
  if (!project) return;
  const percent = progress(project);
  $('#detail-content').innerHTML = `<div class="dialog-heading"><div><small>${esc(project.type)}</small><h2 id="detail-title">${esc(project.title)}</h2></div><button class="icon-button" data-close="detail-dialog" aria-label="Cerrar">×</button></div><div class="detail-progress"><span>Progreso</span><strong>${percent}%</strong><progress value="${percent}" max="100"></progress></div><div class="detail-steps">${project.steps.map(step => {
    const logged = state.sessions.filter(session => session.stepId === step.id).reduce((sum, session) => sum + session.minutes, 0);
    return `<article class="detail-step"><div class="step-heading">${isReadOnly() ? `<span class="check readonly-check">${step.done ? icon('check') : ''}</span>` : `<button class="check" data-action="toggle" data-project="${esc(project.id)}" data-step="${esc(step.id)}" aria-label="${step.done ? 'Desmarcar' : 'Completar'}">${step.done ? icon('check') : ''}</button>`}<strong>${esc(step.title)}</strong>${logged ? `<small>${logged} min</small>` : ''}</div>${isReadOnly() ? `<p>${step.date || 'Sin fecha'} · ${step.minutes} min</p>` : `<div class="step-options"><label>Fecha<input type="date" value="${esc(step.date)}" data-field="date" data-step="${esc(step.id)}"></label><label>Minutos<input type="number" min="5" max="600" step="5" value="${step.minutes}" data-field="minutes" data-step="${esc(step.id)}"></label>${!step.done ? `<button class="text-button" data-action="log" data-project="${esc(project.id)}" data-step="${esc(step.id)}">Registrar avance</button>` : ''}</div>`}</article>`;
  }).join('')}</div>${isReadOnly() ? '' : '<form id="add-step" class="add-step"><input name="title" maxlength="160" required placeholder="Agregar otro paso"><button class="secondary">Agregar</button></form>'}`;
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

function updateCloudUi() {
  const name = $('#profile-name');
  const label = $('#cloud-label');
  if (!cloudInfo.authenticated) {
    name.textContent = 'Mi cuenta';
    label.textContent = cloudInfo.configured ? 'Sin conectar' : 'Solo en este dispositivo';
    return;
  }
  name.textContent = cloudInfo.profile?.full_name || cloudInfo.email?.split('@')[0] || 'Mi cuenta';
  label.textContent = cloudInfo.role === 'admin' ? 'Administrador' : syncState === 'saving' ? 'Guardando…' : syncState === 'error' ? 'Revisar conexión' : 'Sincronizado';
}

function renderAccountContent(message = '', email = '', mode = 'signin') {
  const container = $('#account-content');
  if (!cloudInfo.configured) {
    container.innerHTML = '<p>Podés seguir usando Rumbo en este dispositivo.</p>';
    return;
  }
  if (!cloudInfo.authenticated) {
    const notice = message ? `<div class="inline-message">${esc(message)}</div>` : '';
    container.innerHTML = mode === 'signup' ? `${notice}<form id="signup-form"><label>Nombre completo<input name="fullName" autocomplete="name" maxlength="100" required></label><label>Puesto<input name="position" autocomplete="organization-title" maxlength="100" required></label><label>Correo<input type="email" name="email" autocomplete="email" maxlength="254" required value="${esc(email)}"></label><label>Contraseña<input type="password" name="password" autocomplete="new-password" minlength="8" maxlength="72" required></label><button class="primary">Crear cuenta</button><button class="text-button" type="button" data-action="show-signin">Ya tengo cuenta</button></form>` : `${notice}<form id="signin-form"><label>Correo<input type="email" name="email" autocomplete="email" maxlength="254" required value="${esc(email)}"></label><label>Contraseña<input type="password" name="password" autocomplete="current-password" minlength="8" maxlength="72" required></label><button class="primary">Entrar</button><button class="text-button" type="button" data-action="show-signup">Crear cuenta</button></form>`;
    return;
  }
  if (!cloudInfo.profile?.full_name) {
    container.innerHTML = '<div class="inline-message">Completá tu perfil para que el equipo pueda identificarte.</div><form id="profile-form"><label>Nombre completo<input name="fullName" maxlength="100" required></label><label>Puesto<input name="position" maxlength="100" required></label><button class="primary">Guardar</button></form><button class="text-button" data-action="signout">Cerrar sesión</button>';
    return;
  }
  const team = cloudInfo.team?.name ? `<p>Equipo: <strong>${esc(cloudInfo.team.name)}</strong></p>` : '';
  container.innerHTML = `<div class="account-state"><span class="status-badge">${cloudInfo.role === 'admin' ? 'Administrador' : 'Colaborador'}</span><h3>${esc(cloudInfo.profile.full_name)}</h3><p>${esc(cloudInfo.profile.position || '')}</p>${team}<button class="secondary" data-action="signout">Cerrar sesión</button></div>`;
}

function resetToAnonymous() {
  activeStorageKey = storageKey;
  state = demoState();
  cloudInfo = { configured: true, authenticated: false, role: null, email: '', workspace: null, profile: null, team: null, people: [] };
  adminPerson = null;
  syncState = 'local';
  render();
}

function applyCloudWorkspace(result) {
  cloudInfo = { configured: true, authenticated: true, role: result.role, email: result.email, workspace: result.workspace, profile: result.profile, team: result.team, people: result.people || [] };
  if (result.role === 'admin') {
    adminPerson = null;
    syncState = 'synced';
    location.hash = 'equipo';
    render();
    if (!result.profile?.full_name) { renderAccountContent(); $('#account-dialog').showModal(); }
    return;
  }
  activeStorageKey = scopedStorageKey(result.workspace.id);
  const pendingKey = `rumbo.pending.${result.workspace.id}`;
  let candidate = result.state;
  if (localStorage.getItem(pendingKey)) {
    try {
      const localCandidate = migrateState(JSON.parse(localStorage.getItem(activeStorageKey)));
      if (validState(localCandidate)) candidate = localCandidate;
    } catch { /* La copia de la nube sigue disponible. */ }
  }
  const incoming = migrateState(candidate);
  if (validState(incoming)) state = incoming;
  syncState = localStorage.getItem(pendingKey) ? 'saving' : 'synced';
  if (!storageBlocked) localStorage.setItem(activeStorageKey, JSON.stringify(state));
  if (syncState === 'saving') save(); else render();
  if (!result.profile?.full_name) { renderAccountContent(); $('#account-dialog').showModal(); }
}

async function loadCloudWorkspace() {
  const result = await window.RumboCloud.bootstrap(state);
  if (result) applyCloudWorkspace(result);
}

async function initializeCloud() {
  try {
    const result = await window.RumboCloud.init(async (next, event) => {
      if (authTransition) return;
      if (!next && cloudInfo.authenticated) { resetToAnonymous(); toast('Sesión cerrada'); }
      else if (next && !cloudInfo.authenticated && event === 'SIGNED_IN') { cloudInfo.authenticated = true; await loadCloudWorkspace(); }
    });
    cloudInfo.configured = result.configured;
    cloudInfo.authenticated = Boolean(result.session);
    updateCloudUi();
    if (result.session) await loadCloudWorkspace();
  } catch {
    cloudInfo.configured = true;
    syncState = 'error';
    updateCloudUi();
    toast('No pudimos conectar con la nube.');
  }
}

document.addEventListener('click', event => {
  const close = event.target.closest('[data-close]');
  if (close) { $('#' + close.dataset.close).close(); return; }
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const { action, project, step } = button.dataset;
  if (isReadOnly() && ['new', 'toggle', 'tomorrow', 'log', 'start-own'].includes(action)) { toast('Este acceso es de solo lectura.'); return; }
  if (action === 'account') { renderAccountContent(); $('#account-dialog').showModal(); return; }
  if (action === 'show-signup') { renderAccountContent('', '', 'signup'); return; }
  if (action === 'show-signin') { renderAccountContent(); return; }
  if (action === 'new') { openNewLearning(); return; }
  if (action === 'detail') { openDetail(project); return; }
  if (action === 'log') { openProgress(project, step); return; }
  if (action === 'toggle') {
    state = toggleStep(state, project, step);
    save();
    if ($('#detail-dialog').open) drawDetail();
    toast('Progreso actualizado');
    return;
  }
  if (action === 'tomorrow') { findStep(project, step).date = tomorrow(); save(); toast('Movido a mañana'); return; }
  if (action === 'start-own') {
    if (!confirm('¿Empezar con un espacio vacío? Se quitarán los ejemplos de este dispositivo.')) return;
    state = { version: 2, demo: false, projects: [], sessions: [], reviews: [] };
    save();
    openNewLearning();
    return;
  }
  if (action === 'admin-person') { adminPerson = cloudInfo.people.find(person => person.user_id === button.dataset.user) || null; render(); return; }
  if (action === 'admin-back') { adminPerson = null; render(); return; }
  if (action === 'team-invite') {
    button.disabled = true;
    window.RumboCloud.createInvite().then(link => navigator.clipboard.writeText(link)).then(() => toast('Enlace copiado')).catch(() => toast('No pudimos crear la invitación.')).finally(() => { button.disabled = false; });
    return;
  }
  if (action === 'signout') {
    button.disabled = true;
    authTransition = true;
    window.RumboCloud.signOut().then(() => { $('#account-dialog').close(); resetToAnonymous(); toast('Sesión cerrada'); }).catch(() => { button.disabled = false; toast('No pudimos cerrar la sesión.'); }).finally(() => { authTransition = false; });
  }
});

$('#progress-form').addEventListener('submit', event => {
  event.preventDefault();
  const data = new FormData(event.target);
  state.sessions.push({ id: crypto.randomUUID(), projectId: activeProject, stepId: activeStep, date: data.get('date'), minutes: Number(data.get('minutes')), note: data.get('note').trim(), createdAt: new Date().toISOString() });
  const step = findStep(activeProject, activeStep);
  if (data.get('complete') && !step.done) { step.done = true; step.completedAt = new Date().toISOString(); }
  save();
  $('#progress-dialog').close();
  if ($('#detail-dialog').open) drawDetail();
  toast('Avance guardado');
});

$('#detail-content').addEventListener('change', event => {
  const field = event.target.dataset.field;
  if (!field) return;
  if (!event.target.checkValidity()) { event.target.reportValidity(); return; }
  findStep(activeProject, event.target.dataset.step)[field] = field === 'minutes' ? Number(event.target.value) : event.target.value;
  save();
});

$('#detail-content').addEventListener('submit', event => {
  event.preventDefault();
  const data = new FormData(event.target);
  if (event.target.id === 'project-form') {
    const title = data.get('title').trim();
    const stepTitle = data.get('step').trim();
    if (!title || !stepTitle) return;
    const project = { id: crypto.randomUUID(), title, goal: '', type: data.get('type'), color: 0, steps: [{ id: crypto.randomUUID(), title: stepTitle, done: false, date: dayKey(), minutes: 25, completedAt: null }] };
    state.projects.push(project);
    activeProject = project.id;
    save();
    drawDetail();
    toast('Aprendizaje creado');
    return;
  }
  if (event.target.id === 'add-step') {
    const title = data.get('title').trim();
    if (!title) return;
    state.projects.find(project => project.id === activeProject).steps.push({ id: crypto.randomUUID(), title, done: false, date: '', minutes: 25, completedAt: null });
    save();
    drawDetail();
  }
});

$('#account-content').addEventListener('submit', async event => {
  if (!['signin-form', 'signup-form', 'profile-form'].includes(event.target.id)) return;
  event.preventDefault();
  const data = new FormData(event.target);
  if (event.target.id === 'profile-form') {
    try {
      const updated = await window.RumboCloud.updateProfile(data.get('fullName').trim(), data.get('position').trim());
      cloudInfo.profile = updated.profile;
      cloudInfo.team = updated.team;
      $('#account-dialog').close();
      render();
    } catch { toast('No pudimos guardar tu perfil.'); }
    return;
  }
  const email = data.get('email').trim();
  authTransition = true;
  try {
    if (event.target.id === 'signup-form') {
      const result = await window.RumboCloud.signUp({ fullName: data.get('fullName').trim(), position: data.get('position').trim(), email, password: data.get('password') });
      if (result.needsConfirmation) { renderAccountContent('Revisá tu correo para confirmar la cuenta.', email); return; }
    } else await window.RumboCloud.signIn(email, data.get('password'));
    await loadCloudWorkspace();
    $('#account-dialog').close();
    toast('Cuenta conectada');
  } catch (error) {
    const message = error.message.includes('Email not confirmed') ? 'Confirmá tu correo antes de entrar.' : error.message.includes('Invalid login') ? 'El correo o la contraseña no coinciden.' : 'No pudimos completar el acceso.';
    renderAccountContent(message, email, event.target.id === 'signup-form' ? 'signup' : 'signin');
  } finally { authTransition = false; }
});

window.addEventListener('hashchange', render);
window.addEventListener('storage', event => {
  if (event.key !== activeStorageKey || !event.newValue) return;
  try {
    const incoming = migrateState(JSON.parse(event.newValue));
    if (validState(incoming)) { state = incoming; render(); }
  } catch { /* Se ignoran datos incompletos de otra pestaña. */ }
});

const pendingInvite = new URLSearchParams(location.search).get('invite');
if (pendingInvite) {
  window.RumboCloud.rememberInvite(pendingInvite);
  history.replaceState(null, '', location.pathname + location.hash);
}

render();
initializeCloud();

if (document.modelContext?.registerTool) {
  const lifecycle = new AbortController();
  Promise.resolve(document.modelContext.registerTool({
    name: 'read_learning_progress', title: 'Consultar mis aprendizajes', description: 'Consulta los avances de este navegador sin modificar datos.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute(input) {
      if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length) throw new Error('Se espera un objeto vacío.');
      return { demo: state.demo, week: weekSummary(state, weekStart()), projects: state.projects.map(project => ({ title: project.title, progress: progress(project), steps: project.steps.map(step => ({ title: step.title, done: step.done, date: step.date })) })) };
    }
  }, { signal: lifecycle.signal })).catch(() => {});
  window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
}
