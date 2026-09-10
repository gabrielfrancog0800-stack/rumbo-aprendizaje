import test from 'node:test';
import assert from 'node:assert/strict';
import {progress, toggleStep, demoState, validState, dayKey} from '../public/model.js';
test('completar y deshacer actualiza progreso sin alterar el estado anterior',()=>{
  const initial={projects:[{id:'p',steps:[{id:'a',done:false},{id:'b',done:false}]}]};
  const updated=toggleStep(initial,'p','a','2026-09-10T12:00:00Z');
  assert.equal(progress(updated.projects[0]),50);
  assert.equal(progress(initial.projects[0]),0);
  assert.equal(updated.projects[0].steps[0].completedAt,'2026-09-10T12:00:00Z');
  const undone=toggleStep(updated,'p','a');
  assert.equal(progress(undone.projects[0]),0);
  assert.equal(undone.projects[0].steps[0].completedAt,null);
});
test('demo válida con tres prioridades y serialización sin pérdida',()=>{
  const demo=demoState();
  assert.equal(validState(demo),true);
  assert.equal(demo.projects.flatMap(p=>p.steps).filter(s=>s.date===dayKey()&&!s.done).length,3);
  assert.deepEqual(JSON.parse(JSON.stringify(demo)),demo);
});
test('datos inválidos no se aceptan y un aprendizaje vacío no divide por cero',()=>{
  assert.equal(validState({version:1,projects:[{}]}),false);
  assert.equal(validState(null),false);
  assert.equal(progress({steps:[]}),0);
});
