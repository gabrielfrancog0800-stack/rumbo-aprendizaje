import test from 'node:test';
import assert from 'node:assert/strict';
import {addDays, progress, toggleStep, demoState, migrateState, validState, dayKey, weekStart, weekSummary} from '../public/model.js';
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
  assert.equal(validState({version:2,projects:[{}],sessions:[],reviews:[]}),false);
  assert.equal(validState(null),false);
  assert.equal(progress({steps:[]}),0);
});
test('migra datos de fase 1 sin perder aprendizajes',()=>{
  const old={version:1,demo:false,projects:[]};
  const migrated=migrateState(old);
  assert.equal(migrated.version,2);
  assert.deepEqual(migrated.projects,[]);
  assert.deepEqual(migrated.sessions,[]);
  assert.deepEqual(migrated.reviews,[]);
});
test('resume la semana con pasos y avances parciales',()=>{
  const monday=weekStart(new Date(2026,8,10));
  const state={version:2,demo:false,projects:[{id:'p',title:'Curso',goal:'Aprender',type:'Curso',color:0,steps:[{id:'s',title:'Paso',done:true,date:monday,minutes:30,completedAt:`${monday}T12:00:00`}]}],sessions:[{id:'x',projectId:'p',stepId:'s',date:addDays(monday,1),minutes:20,note:''}],reviews:[]};
  assert.deepEqual(weekSummary(state,monday),{planned:1,completed:1,minutes:20,daysActive:1});
});
