export function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function dateFromKey(key) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(key, amount) {
  const date = typeof key === 'string' ? dateFromKey(key) : new Date(key);
  date.setDate(date.getDate() + amount);
  return dayKey(date);
}

export function tomorrow() { return addDays(dayKey(), 1); }

export function weekStart(date = new Date()) {
  const result = new Date(date);
  const weekday = result.getDay() || 7;
  result.setDate(result.getDate() - weekday + 1);
  return dayKey(result);
}

export function weekDays(start) {
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

export function progress(project) {
  return project.steps.length ? Math.round(project.steps.filter(step => step.done).length / project.steps.length * 100) : 0;
}

export function toggleStep(state, projectId, stepId, now = new Date().toISOString()) {
  return { ...state, projects: state.projects.map(project => project.id !== projectId ? project : { ...project, steps: project.steps.map(step => step.id !== stepId ? step : { ...step, done: !step.done, completedAt: step.done ? null : now }) }) };
}

export function weekSummary(state, start) {
  const end = addDays(start, 6);
  const planned = state.projects.flatMap(project => project.steps).filter(step => step.date >= start && step.date <= end);
  const completed = planned.filter(step => step.done && step.completedAt && dayKey(new Date(step.completedAt)) >= start && dayKey(new Date(step.completedAt)) <= end);
  const sessions = state.sessions.filter(session => session.date >= start && session.date <= end);
  return { planned: planned.length, completed: completed.length, minutes: sessions.reduce((sum, session) => sum + session.minutes, 0), daysActive: new Set(sessions.map(session => session.date)).size };
}

export function migrateState(input) {
  if (!input || !Array.isArray(input.projects)) return null;
  if (input.version === 2) return input;
  if (input.version === 1) return { ...input, version: 2, sessions: [], reviews: [] };
  return null;
}

export function validState(state) {
  return state?.version === 2 && typeof state.demo === 'boolean' && Array.isArray(state.sessions) && Array.isArray(state.reviews) && Array.isArray(state.projects) && state.projects.every(project =>
    typeof project.id === 'string' && typeof project.title === 'string' && typeof project.goal === 'string' && ['Curso', 'Habilidad', 'Proyecto'].includes(project.type) && Number.isInteger(project.color) && Array.isArray(project.steps) && project.steps.every(step =>
      typeof step.id === 'string' && typeof step.title === 'string' && typeof step.done === 'boolean' && typeof step.date === 'string' && Number.isFinite(step.minutes)
    )
  ) && state.sessions.every(session => typeof session.id === 'string' && typeof session.projectId === 'string' && typeof session.stepId === 'string' && typeof session.date === 'string' && Number.isFinite(session.minutes) && typeof session.note === 'string') && state.reviews.every(review => typeof review.week === 'string');
}

export function demoState() {
  const today = dayKey();
  const monday = weekStart();
  const make = (title, done, minutes, date = '') => ({ id: crypto.randomUUID(), title, done, minutes, date, completedAt: done ? new Date().toISOString() : null });
  const projects = [
    { id: crypto.randomUUID(), title: 'Python desde cero', type: 'Curso', goal: 'Construir una base sólida para automatizar tareas.', color: 0, steps: [make('Conocer variables y tipos', true, 20, addDays(monday, 0)), make('Practicar listas y diccionarios', false, 30, today), make('Resolver un ejercicio con bucles', false, 25, addDays(today, 1)), make('Crear mi primera función', false, 30)] },
    { id: crypto.randomUUID(), title: 'Hablar mejor con la IA', type: 'Habilidad', goal: 'Escribir instrucciones claras y evaluar las respuestas.', color: 1, steps: [make('Definir objetivo y contexto', true, 15, addDays(monday, 1)), make('Comparar tres versiones de un prompt', false, 20, today), make('Guardar mi plantilla de instrucciones', false, 15, addDays(today, 2))] },
    { id: crypto.randomUUID(), title: 'Mi centro de control', type: 'Proyecto', goal: 'Crear un lugar para organizar mis aprendizajes.', color: 2, steps: [make('Definir las funciones principales', true, 20, addDays(monday, 0)), make('Probar el flujo de registrar un avance', false, 15, today), make('Organizar mi primera semana', false, 20, addDays(today, 1)), make('Compartir mis resultados', false, 15)] }
  ];
  return { version: 2, demo: true, projects, sessions: [], reviews: [] };
}
