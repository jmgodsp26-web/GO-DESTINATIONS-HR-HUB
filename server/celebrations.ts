export const REACTIONS = ['🎉','🎂','❤️','👏'] as const;
export interface CelebrationPreference {id:string; birthday_visible:boolean;}
export interface CelebrationReaction {id:string; celebration_id:string; user_id:string; emoji:string;}
export function celebrationsFor(users:any[], preferences:CelebrationPreference[], reactions:CelebrationReaction[], actor:any, now=new Date()) {
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:actor.timezone || 'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const base=new Date(today+'T00:00:00Z');
 const active=users.filter(u=>u.status==='active');
 const items:any[]=[];
 for (const user of active) for (const type of ['birthday','anniversary']) {
  if(type==='birthday' && preferences.find(p=>p.id===user.id)?.birthday_visible===false) continue;
  const raw=type==='birthday'?(user.date_of_birth||user.birthday):(user.hire_date||user.date_joined);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(raw||'') || !Number.isFinite(Date.parse(raw)) || new Date(raw).toISOString().slice(0,10)!==raw)continue;
  for(let year=base.getUTCFullYear();year<=base.getUTCFullYear()+1;year++) {
   let day=raw.slice(5); if(day==='02-29' && new Date(Date.UTC(year,1,29)).getUTCMonth()!==1)day='02-28';
   const occurrence=year+'-'+day, distance=Math.round((Date.parse(occurrence)-base.valueOf())/86400000);
   const years=year-Number(raw.slice(0,4));
   if(distance<0||distance>7 || (type==='anniversary'&&years<1) || (type==='birthday'&&years<0))continue;
   const id=`${user.id}:${type}:${occurrence}`;
   items.push({id,employee_id:user.id,name:user.full_name,type,date:occurrence,days_until:distance,...(type==='anniversary'?{years}:{}),
    reactions:REACTIONS.map(emoji=>({emoji,people:reactions.filter(r=>r.celebration_id===id&&r.emoji===emoji).flatMap(r=>{const p=active.find(u=>u.id===r.user_id);return p?[{id:p.id,name:p.full_name}]:[]})})),
    my_reaction:reactions.find(r=>r.celebration_id===id&&r.user_id===actor.id)?.emoji||null});
  }
 }
 return {today,items:items.sort((a,b)=>a.date.localeCompare(b.date)||a.name.localeCompare(b.name)),birthday_visible:preferences.find(p=>p.id===actor.id)?.birthday_visible!==false};
}
