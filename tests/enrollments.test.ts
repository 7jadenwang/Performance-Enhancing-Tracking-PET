import {it,expect} from 'vitest';
import {program} from '../src/program/catalog';
import {initialState} from '../src/domain/schema';
import {createWorkout,createRow} from '../src/domain/records';
import {createEnrollment,enrollmentProgress,scheduledSessions,transitionEnrollment} from '../src/program/enrollments';
it('anchors D1 to Monday on or after the requested start and keeps D7 Sunday',()=>{
 const run=createEnrollment('lp','April-W1D1','2026-10-13');
 expect(run.startDate).toBe('2026-10-19');
 const dates=scheduledSessions(run,program);
 expect(dates.find(p=>p.session.id==='April-W1D1')?.date).toBe('2026-10-19');
 const sunday=dates.find(p=>p.session.day===7)!;
 expect(new Date(sunday.date+'T12:00:00Z').getUTCDay()).toBe(0);
});
it('does not complete sessions when calendar dates pass and counts only performed partial days',()=>{
 const run=createEnrollment('lp','April-W1D1','2020-01-01');
 expect(enrollmentProgress(run,[],program).nextSessionId).toBe('April-W1D1');
 const logs=[createWorkout({enrollmentId:run.id,status:'partial'}),createWorkout({enrollmentId:run.id,status:'partial',rows:[createRow({confirmed:true,reps:3})]})];
 expect(enrollmentProgress(run,logs,program).trainingDays).toBe(1);
 expect(enrollmentProgress(run,logs,program).completed).toBe(0);
});
it('separates repeated runs and keeps one active and one queued enrollment',()=>{
 let s=initialState();const a=createEnrollment('lp','April-W1D1','2026-10-12'),b=createEnrollment('up','July-W1D1','2026-10-19');
 s=transitionEnrollment(s,{type:'queue',enrollment:a},program);
 s=transitionEnrollment(s,{type:'start',id:a.id,date:'2026-10-12'},program);
 s=transitionEnrollment(s,{type:'queue',enrollment:b},program);
 s=transitionEnrollment(s,{type:'start',id:b.id,date:'2026-10-19'},program);
 expect(s.enrollments.filter(r=>r.status==='active')).toHaveLength(1);
 expect(s.enrollments.find(r=>r.id===a.id)?.status).toBe('paused');
 const logs=[createWorkout({enrollmentId:a.id,status:'completed'})];
 expect(enrollmentProgress(b,logs,program).completed).toBe(0);
});
it('resumes the first unresolved session on its prescribed weekday without moving historic work',()=>{
 let s=initialState();const run=createEnrollment('lp','April-W1D1','2026-10-12');
 s=transitionEnrollment(s,{type:'queue',enrollment:run},program);s=transitionEnrollment(s,{type:'start',id:run.id,date:'2026-10-12'},program);
 const historical=createWorkout({enrollmentId:run.id,sessionId:'April-W1D1',localDate:'2026-10-12',status:'completed'});s.workouts=[historical];
 s=transitionEnrollment(s,{type:'pause',id:run.id,date:'2026-10-13'},program);
 s=transitionEnrollment(s,{type:'resume',id:run.id,date:'2026-10-18'},program);
 const resumed=s.enrollments.find(r=>r.id===run.id)!;
 expect(resumed.reschedules['April-W1D2']).toBe('2026-10-20');
 expect(s.workouts[0]).toEqual(historical);
});
it('cancellation preserves history and optional sessions do not block completion',()=>{
 let s=initialState();const run=createEnrollment('up','July-W4D5','2026-10-16');s=transitionEnrollment(s,{type:'queue',enrollment:run},program);
 s=transitionEnrollment(s,{type:'cancel',id:run.id,date:'2026-10-17'},program);
 expect(s.enrollments.find(r=>r.id===run.id)?.status).toBe('cancelled');
 expect(()=>transitionEnrollment(s,{type:'resume',id:run.id,date:'2026-10-18'},program)).toThrow();
});
it('extends active UP enrollments while keeping completed runs resolved',()=>{
 const run=createEnrollment('up','July-W1D1','2026-07-06');
 const earlierSessions=program.sessions.filter(s=>s.phaseId==='up-1'||s.phaseId==='up-2');
 run.skippedSessionIds=earlierSessions.map(s=>s.id);
 expect(enrollmentProgress(run,[],program).nextSessionId).toBe('Sept-W1D1');
 expect(enrollmentProgress({...run,status:'completed'},[],program).requiredRemaining).toBe(0);
 const dates=scheduledSessions(run,program);
 expect(dates.find(p=>p.session.id==='Sept-W1D1')?.date).toBe('2026-08-31');
 expect(dates.find(p=>p.session.id==='Oct-W1D1')?.date).toBe('2026-09-28');
});
