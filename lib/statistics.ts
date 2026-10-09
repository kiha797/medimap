import {db,setting,put} from './database';
// These caches contain only derived statistics, never institution or customer source records.
export async function cached<T>(key:string,seconds:number,build:()=>Promise<T>):Promise<T>{
 const raw=await setting(key);if(raw){const saved=JSON.parse(raw);if(saved.until>Date.now())return saved.data;}
 const data=await build();await put(key,JSON.stringify({until:Date.now()+seconds*1000,data}));return data;
}
export async function ensureStatistics(g:string){
 if(!g||await setting('statistics_ready_'+g))return;
 const now=Date.now(),lockKey='statistics_lock_'+g;
 const lock=await db().prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(settings.value AS INTEGER)<?').bind(lockKey,String(now+120000),now).run();
 if(lock.meta.changes!==1)throw new Error('저장된 기관 데이터로 지역 통계를 준비 중입니다. 잠시 후 다시 조회해 주세요.');
 try{
  if(await setting('statistics_ready_'+g))return;
  const statements=[db().prepare('DELETE FROM institution_statistics WHERE generation=?').bind(g)];
  // Build each geographic level once; subsequent reads touch only the selected level.
  for(const level of ['all','sido','sigungu','dong']){
   const fields=level==='all'?[]:level==='sido'?['sido']:level==='sigungu'?['sido','sigungu']:['sido','sigungu','dong'];
   const selected=['sido','sigungu','dong'].map(f=>fields.includes(f)?f:"''");
   statements.push(db().prepare(`INSERT INTO institution_statistics(generation,level,sido,sigungu,dong,kind,category,total) SELECT generation,?,${selected.join(',')},kind,category,COUNT(*) FROM institutions WHERE generation=? GROUP BY generation,${[...fields,'kind','category'].join(',')}`).bind(level,g));
  }
  statements.push(db().prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind('statistics_ready_'+g,new Date().toISOString()));
  await db().batch(statements);
 }finally{await put(lockKey,'0');}
}
export async function invalidateCoverage(){await put('coverage_revision',crypto.randomUUID());}
