export function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function tomorrow() { const d = new Date(); d.setDate(d.getDate() + 1); return dayKey(d); }
export function progress(project) {
  return project.steps.length ? Math.round(project.steps.filter(s => s.done).length / project.steps.length * 100) : 0;
}
export function toggleStep(state, projectId, stepId, now = new Date().toISOString()) {
  return { ...state, projects: state.projects.map(p => p.id !== projectId ? p : { ...p, steps: p.steps.map(s => s.id !== stepId ? s : { ...s, done: !s.done, completedAt: s.done ? null : now }) }) };
}
export function validState(s) {
  return s?.version === 1 && typeof s.demo === 'boolean' && Array.isArray(s.projects) && s.projects.every(p => typeof p.id === 'string' && typeof p.title === 'string' && typeof p.goal === 'string' && ['Curso','Habilidad','Proyecto'].includes(p.type) && Number.isInteger(p.color) && Array.isArray(p.steps) && p.steps.every(t => typeof t.id === 'string' && typeof t.title === 'string' && typeof t.done === 'boolean' && typeof t.date === 'string' && Number.isFinite(t.minutes)));
}
export function demoState() {
  const make = (title, done, minutes, index) => ({ id: crypto.randomUUID(), title, done, minutes, date: index === 0 ? dayKey() : '', completedAt: null });
  return { version: 1, demo: true, projects: [
    { id: crypto.randomUUID(), title: 'Python desde cero', type: 'Curso', goal: 'Construir una base sólida para automatizar tareas.', color: 0, steps: [['Conocer variables y tipos',true,20],['Practicar listas y diccionarios',false,30],['Resolver un ejercicio con bucles',false,25],['Crear mi primera función',false,30]].map((s,i)=>make(...s,i===1?0:1)) },
    { id: crypto.randomUUID(), title: 'Hablar mejor con la IA', type: 'Habilidad', goal: 'Escribir instrucciones claras y evaluar las respuestas.', color: 1, steps: [['Definir objetivo y contexto',true,15],['Comparar tres versiones de un prompt',false,20],['Guardar mi plantilla de instrucciones',false,15]].map((s,i)=>make(...s,i===1?0:1)) },
    { id: crypto.randomUUID(), title: 'Mi centro de control', type: 'Proyecto', goal: 'Crear un lugar para organizar mis aprendizajes.', color: 2, steps: [['Definir las funciones principales',true,20],['Probar el flujo de registrar un avance',false,15],['Organizar mi primera semana',false,20],['Compartir mis resultados',false,15]].map((s,i)=>make(...s,i===1?0:1)) }
  ] };
}
