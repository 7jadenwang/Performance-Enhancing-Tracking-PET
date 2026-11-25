import {enrollmentSchema,parseState,localToday,type AthleteState,type Enrollment,type Workout,type Program,type LocalDate} from '../domain/schema';
import {program} from './catalog';
import {addDays,firstWeekdayOnOrAfter} from './schedule';
const offset=(s:Program['sessions'][number])=>s.blockIndex*28+(s.week-1)*7+s.day-1;
export function createEnrollment(programId:'lp'|'up',entrySessionId:string,startDate:LocalDate):Enrollment{
 const entry=program.sessions.find(s=>s.id===entrySessionId&&s.programId===programId);
 if(!entry)throw Error('Unknown program entry');
 return enrollmentSchema.parse({id:crypto.randomUUID(),programId,programVersion:program.version,entrySessionId,startDate:firstWeekdayOnOrAfter(startDate,entry.day),status:'queued',reschedules:{},skippedSessionIds:[],continuationSessionId:entrySessionId,events:[],targetRevisions:[],bridge:null});
}
export function scheduledSessions(enrollment:Enrollment,catalog:Program){
 const entry=catalog.sessions.find(s=>s.id===enrollment.entrySessionId);
 if(!entry||entry.programId!==enrollment.programId)throw Error('Invalid enrollment entry');
 return catalog.sessions.filter(s=>s.programId===enrollment.programId&&offset(s)>=offset(entry)).map(session=>({session,date:enrollment.reschedules[session.id]??addDays(enrollment.startDate,offset(session)-offset(entry))}));
}
export function performed(w:Workout){return ['completed','partial'].includes(w.status)&&(w.rows.some(r=>r.confirmed&&(r.reps!==null||r.holdSeconds!==null||r.distanceMetres!==null||r.workSeconds!==null))||(w.actualDuration!==null&&w.actualRpe!==null));}
export function enrollmentProgress(e:Enrollment,workouts:Workout[],catalog:Program){
 const own=workouts.filter(w=>w.enrollmentId===e.id);
 const last=new Map<string,Workout>();
 own.slice().sort((a,b)=>a.updatedAt.localeCompare(b.updatedAt)||a.id.localeCompare(b.id)).forEach(w=>{if(w.sessionId)last.set(w.sessionId,w)});
 const scheduled=scheduledSessions(e,catalog),required=scheduled.filter(p=>!p.session.optional),resolved=new Set(e.skippedSessionIds);
 for(const [id,w]of last)if(w.status==='completed'||w.status==='skipped')resolved.add(id);
 const remaining=e.status==='completed'?[]:required.filter(p=>!resolved.has(p.session.id));
 const end=e.status==='active'?undefined:e.events.filter(v=>['pause','cancel','complete'].includes(v.type)).at(-1)?.date;
 return {trainingDays:new Set(own.filter(performed).map(w=>w.localDate)).size,elapsedDays:Math.max(0,Math.round((Date.parse((end??localToday())+'T12:00:00Z')-Date.parse(e.startDate+'T12:00:00Z'))/86400000)+1),completed:[...last.values()].filter(w=>w.status==='completed').length,partial:[...last.values()].filter(w=>w.status==='partial').length,skipped:new Set([...e.skippedSessionIds,...[...last.values()].filter(w=>w.status==='skipped').map(w=>w.sessionId!)]).size,nextSessionId:remaining[0]?.session.id??null,requiredRemaining:remaining.length,resolvedSessionIds:[...resolved]};
}
export type EnrollmentCommand={type:'queue';enrollment:Enrollment}|{type:'start'|'resume'|'pause'|'cancel'|'complete';id:string;date:LocalDate}|{type:'skip';id:string;sessionId:string;date:LocalDate}|{type:'reschedule';id:string;sessionId:string;date:LocalDate};
export function transitionEnrollment(input:AthleteState,command:EnrollmentCommand,catalog:Program):AthleteState{
 const s=structuredClone(input);
 if(command.type==='queue'){
  if(s.enrollments.some(e=>e.id===command.enrollment.id))throw Error('Enrollment already exists');
  s.enrollments=s.enrollments.map(e=>e.status==='queued'?{...e,status:'cancelled' as const}:e);
  s.enrollments.push({...command.enrollment,status:'queued'});return parseState(s);
 }
 const e=s.enrollments.find(e=>e.id===command.id);if(!e)throw Error('Unknown enrollment');
 const progress=enrollmentProgress(e,s.workouts,catalog);
 if(command.type==='start'||command.type==='resume'){
  if(command.type==='start'&&e.status!=='queued')throw Error('Only queued programs can start');
  if(command.type==='resume'&&e.status!=='paused')throw Error('Only paused programs can resume');
  for(const other of s.enrollments)if(other.id!==e.id&&other.status==='active'){
   other.status='paused';other.continuationSessionId=enrollmentProgress(other,s.workouts,catalog).nextSessionId;
   other.events.push({id:crypto.randomUUID(),type:'pause',date:command.date,at:new Date().toISOString()});
  }
  const next=progress.nextSessionId;
  if(!next)throw Error('No unresolved sessions to continue');
  const schedule=scheduledSessions(e,catalog),position=schedule.findIndex(p=>p.session.id===next),nextDate=firstWeekdayOnOrAfter(command.date,schedule[position].session.day);
  const shift=Math.round((Date.parse(nextDate+'T12:00:00Z')-Date.parse(schedule[position].date+'T12:00:00Z'))/86400000);
  for(const p of schedule.slice(position))if(!progress.resolvedSessionIds.includes(p.session.id))e.reschedules[p.session.id]=addDays(p.date,shift);
  e.status='active';e.continuationSessionId=next;
 }else if(command.type==='pause'){
  if(e.status!=='active')throw Error('Only active programs can pause');e.status='paused';e.continuationSessionId=progress.nextSessionId;
 }else if(command.type==='cancel'){e.status='cancelled';e.continuationSessionId=progress.nextSessionId;
 }else if(command.type==='complete'){
  if(progress.requiredRemaining)throw Error('Required source sessions remain unresolved');e.status='completed';e.continuationSessionId=null;
 }else if(command.type==='skip'||command.type==='reschedule'){
  if(!scheduledSessions(e,catalog).some(p=>p.session.id===command.sessionId))throw Error('Session is outside enrollment');
  if(command.type==='skip')e.skippedSessionIds=[...new Set([...e.skippedSessionIds,command.sessionId])];
  else e.reschedules[command.sessionId]=command.date;
 }
 e.events.push({id:crypto.randomUUID(),type:command.type,date:command.date,at:new Date().toISOString()});
 return parseState(s);
}
