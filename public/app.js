import { dayKey, tomorrow, progress, toggleStep, validState, demoState } from './model.js';
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const key = 'rumbo.state.v1';
let state, storageBlocked = false, activeProject = null, toastTimer;
try { const saved = localStorage.getItem(key); state = saved ? JSON.parse(saved) : demoState(); if (!validState(state)) throw Error(); }
catch { state = demoState(); storageBlocked = true; $('#storage-warning').hidden = false; $('#storage-warning').textContent = 'No pudimos leer los datos guardados. Esta sesión es temporal; no se sobrescribirán los datos anteriores.'; }
function save() {
  if (!storageBlocked) try { localStorage.setItem(key, JSON.stringify(state)); } catch { $('#storage-warning').hidden = false; $('#storage-warning').textContent = 'No se pudieron guardar los cambios. Permanecerán solo durante esta sesión.'; }
  render();
}
function toast(message) { clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').hidden = false; toastTimer = setTimeout(()=>$('#toast').hidden = true, 3500); }
function newButton() { return '<button class="primary" data-action="new">＋ Nuevo aprendizaje</button>'; }
function card(p) {
  const done = p.steps.filter(s=>s.done).length, percent = progress(p), next = p.steps.find(s=>!s.done);
  return `<button class="project-card color-${p.color % 3}" data-action="detail" data-project="${esc(p.id)}"><div class="card-top"><span class="project-icon" aria-hidden="true">${p.type==='Curso'?'▤':p.type==='Habilidad'?'✦':'▧'}</span><span class="type">${p.type}</span><span class="card-arrow" aria-hidden="true">↗</span></div><h3>${esc(p.title)}</h3><p class="goal">${esc(p.goal)}</p><div class="progress-label"><span>${done} de ${p.steps.length} pasos</span><strong>${percent}%</strong></div><progress value="${percent}" max="100" aria-label="Progreso de ${esc(p.title)}">${percent}%</progress><div class="card-next">${next?`<small>SIGUIENTE PASO</small><span>${esc(next.title)}</span>`:'<span>✓ Todos los pasos completados</span>'}</div></button>`;
}
function render() {
  const panel = location.hash === '#panel';
  document.querySelectorAll('[data-nav]').forEach(n=>{const active=n.dataset.nav===(panel?'panel':'hoy'); n.classList.toggle('active',active); if(active)n.setAttribute('aria-current','page');else n.removeAttribute('aria-current');});
  $('#date-label').textContent = new Intl.DateTimeFormat('es', { weekday:'long', day:'numeric', month:'long' }).format(new Date());
  $('#demo-banner').hidden = !state.demo;
  const projects = state.projects;
  const all = projects.flatMap(p=>p.steps.map(s=>({...s,project:p})));
  const today = all.filter(s=>s.date && s.date<=dayKey() && (!s.done || s.date===dayKey()));
  const pending = today.filter(s=>!s.done), completedToday = all.filter(s=>s.completedAt && dayKey(new Date(s.completedAt))===dayKey()).length;
  const active = projects.filter(p=>progress(p)<100).length;
  const totalDone = all.filter(s=>s.done).length;
  const hero = `<div class="page-heading"><div><div class="eyebrow">${panel?'TU MAPA DE APRENDIZAJE':'VAMOS PASO A PASO'}</div><h1>${panel?'Mis aprendizajes':'Hoy es un buen día<br>para <em>avanzar.</em>'}</h1><p>${panel?'Todo lo que estás aprendiendo y construyendo, en un lugar.':'Una cosa a la vez. Cada paso cuenta.'}</p></div>${newButton()}</div>`;
  const stats = `<div class="stats"><div><span>Aprendizajes activos</span><strong>${active}<small>en marcha</small></strong></div><div><span>${panel?'Pasos completados':'Avances de hoy'}</span><strong>${panel?totalDone:completedToday}<small>${panel?'en total':'completados'}</small></strong></div><div><span>Tiempo pendiente hoy</span><strong>${pending.reduce((a,s)=>a+s.minutes,0)}<small>min estimados</small></strong></div></div>`;
  const tasks = today.map(s=>`<article class="task ${s.done?'done':''}"><button class="check" data-action="toggle" data-project="${esc(s.project.id)}" data-step="${esc(s.id)}" aria-label="${s.done?'Desmarcar':'Completar'} ${esc(s.title)}" aria-pressed="${s.done}">${s.done?'✓':''}</button><div class="task-text"><span class="task-project">${esc(s.project.title)} ${s.date<dayKey()&&!s.done?'<span class="overdue">· Pendiente anterior</span>':''}</span><strong>${esc(s.title)}</strong></div><span class="minutes">${s.minutes} min</span>${!s.done?`<button class="defer" data-action="tomorrow" data-project="${esc(s.project.id)}" data-step="${esc(s.id)}" title="Mover a mañana">Mañana ↗</button>`:''}</article>`).join('');
  const empty = `<div class="empty"><span aria-hidden="true">✦</span><h3>${projects.length?'Tu día tiene espacio':'Tu próximo aprendizaje empieza aquí'}</h3><p>${projects.length?'Abrí un aprendizaje y elegí un paso para hoy. Con 1–3 prioridades alcanza.':'Agregá un curso, habilidad o proyecto y dividilo en pasos pequeños.'}</p><button class="secondary" data-action="${projects.length?'panel':'new'}">${projects.length?'Elegir mi próximo paso':'Crear mi primer aprendizaje'} ↗</button></div>`;
  $('#view').innerHTML = hero + stats + (panel?'':`<section class="today-section"><div class="section-heading"><h2>Mi enfoque de hoy <span class="count">${pending.length}</span></h2><span>Un toque para registrar tu avance</span></div><div class="task-list">${tasks||empty}</div>${pending.length>3?'<p class="help">Tenés más de 3 prioridades. Podés mover alguna a mañana para aligerar tu día.</p>':''}</section>`) + `<section class="learning-section"><div class="section-heading"><h2>${panel?'Mi recorrido':'En lo que estoy trabajando'}</h2>${panel?'':'<a href="#panel">Ver todo ↗</a>'}</div><div class="project-grid">${projects.map(card).join('')||empty}</div></section>`;
}
function openDetail(id) {
  activeProject = id; drawDetail(); if (!$('#detail-dialog').open) $('#detail-dialog').showModal();
}
function drawDetail() {
  const p = state.projects.find(p=>p.id===activeProject); if(!p)return;
  $('#detail-content').innerHTML = `<div class="dialog-heading"><span class="type">${p.type}</span><button class="icon-button" data-close="detail-dialog" aria-label="Cerrar">×</button></div><h2 id="detail-title">${esc(p.title)}</h2><p>${esc(p.goal)}</p><div class="progress-label"><span>Tu recorrido</span><strong>${progress(p)}%</strong></div><progress value="${progress(p)}" max="100" aria-label="Progreso">${progress(p)}%</progress><div class="detail-steps">${p.steps.map(s=>`<div class="detail-step"><div class="step-heading"><button class="check ${s.done?'checked':''}" data-action="toggle" data-project="${esc(p.id)}" data-step="${esc(s.id)}" aria-label="${s.done?'Desmarcar':'Completar'} ${esc(s.title)}" aria-pressed="${s.done}">${s.done?'✓':''}</button><strong>${esc(s.title)}</strong></div><div class="step-options"><label>Fecha<input type="date" value="${esc(s.date)}" data-field="date" data-step="${esc(s.id)}"></label><label>Minutos<input type="number" min="5" max="600" step="5" value="${s.minutes}" data-field="minutes" data-step="${esc(s.id)}"></label>${!s.done&&s.date!==dayKey()?`<button class="text-button" data-action="today" data-project="${esc(p.id)}" data-step="${esc(s.id)}">Hacer hoy</button>`:''}</div></div>`).join('')}</div><form id="add-step"><label>Agregar otro paso<input name="title" maxlength="160" required placeholder="Un siguiente paso concreto"></label><button class="secondary">＋ Agregar paso</button></form>`;
}
document.addEventListener('click', e=>{
  const close = e.target.closest('[data-close]'); if(close){$('#'+close.dataset.close).close();return;}
  const button=e.target.closest('[data-action]'); if(!button)return;
  const {action,project,step}=button.dataset;
  if(action==='new'){$('#project-dialog').showModal();return;}
  if(action==='panel'){location.hash='panel';return;}
  if(action==='detail'){openDetail(project);return;}
  if(action==='toggle'){state=toggleStep(state,project,step);save(); if($('#detail-dialog').open)drawDetail();toast('Progreso actualizado');}
  if(action==='today'||action==='tomorrow') {
    state.projects.find(p=>p.id===project).steps.find(s=>s.id===step).date=action==='today'?dayKey():tomorrow();save();if($('#detail-dialog').open)drawDetail();toast(action==='today'?'Agregado a tu enfoque de hoy':'Movido a mañana');
  }
});
$('#detail-content').addEventListener('change',e=>{
  const field=e.target.dataset.field;if(!field)return;
  if(!e.target.checkValidity()){e.target.reportValidity();return;}
  const s=state.projects.find(p=>p.id===activeProject).steps.find(s=>s.id===e.target.dataset.step);
  s[field]=field==='minutes'?Number(e.target.value):e.target.value;save();toast('Paso actualizado');
});
$('#detail-content').addEventListener('submit',e=>{
  if(e.target.id!=='add-step')return;e.preventDefault();
  const title=new FormData(e.target).get('title').trim();if(!title)return;
  state.projects.find(p=>p.id===activeProject).steps.push({id:crypto.randomUUID(),title,done:false,date:'',minutes:25,completedAt:null});save();drawDetail();toast('Paso agregado');
});
$('#project-form').addEventListener('submit',e=>{
  e.preventDefault();const data=new FormData(e.target);const title=data.get('title').trim(),goal=data.get('goal').trim(),steps=data.get('steps').split('\n').map(s=>s.trim()).filter(Boolean);
  if(!title||!goal||!steps.length){toast('Escribí un nombre, objetivo y al menos un paso.');return;}
  const p={id:crypto.randomUUID(),title,goal,type:data.get('type'),color:state.projects.length%3,steps:steps.map(title=>({id:crypto.randomUUID(),title,done:false,date:'',minutes:25,completedAt:null}))};
  state.projects.push(p);save();e.target.reset();$('#project-dialog').close();openDetail(p.id);toast('Aprendizaje creado. Elegí tu primer paso para hoy.');
});
$('#start-own').addEventListener('click',()=>$('#reset-dialog').showModal());
$('#confirm-reset').addEventListener('click',()=>{state={version:1,demo:false,projects:[]};save();$('#reset-dialog').close();toast('Tu espacio está listo');});
window.addEventListener('hashchange',render);
window.addEventListener('storage',e=>{if(e.key!==key||!e.newValue)return;try{const incoming=JSON.parse(e.newValue);if(validState(incoming)){state=incoming;render();if($('#detail-dialog').open){if(state.projects.some(p=>p.id===activeProject))drawDetail();else $('#detail-dialog').close();}}}catch{}});
render();
if (document.modelContext?.registerTool) {
  const lifecycle = new AbortController();
  try {
    Promise.resolve(document.modelContext.registerTool({
      name: 'read_learning_progress', title: 'Consultar mis aprendizajes',
      description: 'Consulta los aprendizajes y sus pasos en este navegador, sin modificar datos.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute(input) {
        if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length) throw new Error('Se espera un objeto vacío.');
        return { demo: state.demo, projects: state.projects.map(p => ({ id: p.id, title: p.title, progress: progress(p), steps: p.steps.map(s => ({ title: s.title, done: s.done, date: s.date })) })) };
      }
    }, { signal: lifecycle.signal })).catch(() => {});
    window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
  } catch { /* La interfaz funciona también sin esta API experimental. */ }
}
