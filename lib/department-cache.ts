import {db,setting,put,batch} from './database';
import {departmentName} from './departments';
type Page={total:number,items:any[]};
export async function ensureDepartment(code:string,generation:string,fetchPage:(page:number)=>Promise<Page>){
 const name=departmentName(code);if(!name)throw new Error('지원하는 정부 진료과목 코드를 선택해 주세요.');
 const stateKey='department_'+code,lockKey=stateKey+'_lock';
 let s=JSON.parse(await setting(stateKey)||'null');
 if(s?.generation===generation&&s.done&&Date.now()-Date.parse(s.updatedAt)<86400000)return s;
 if(s?.generation===generation&&s.error&&Date.now()-Date.parse(s.updatedAt)<60000)throw new Error(s.error);
 const now=Date.now();const lock=await db().prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(settings.value AS INTEGER)<?').bind(lockKey,String(now+90000),now).run();
 if(lock.meta.changes!==1)return {code,name,done:false,received:s?.generation===generation?s.received||0:0,total:s?.generation===generation?s.total:null};
 try{
  s=JSON.parse(await setting(stateKey)||'null');
  if(s?.generation===generation&&s.done&&Date.now()-Date.parse(s.updatedAt)<86400000)return s;
  if(!s||s.generation!==generation||s.done||s.error){s={code,name,generation,snapshot:crypto.randomUUID(),page:1,received:0,total:null,done:false,updatedAt:new Date().toISOString()};await put(stateKey,JSON.stringify(s));}
  const result=await fetchPage(s.page);
  if(s.total!==null&&s.total!==result.total)throw new Error('진료과목 조회 중 정부 데이터 건수가 바뀌었습니다. 잠시 후 다시 조회해 주세요.');
  if(result.total<0||result.total>150000||!Number.isInteger(result.total)||result.items.some(x=>!x.ykiho))throw new Error('정부 진료과목 응답을 확인할 수 없습니다.');
  const ids=[...new Set(result.items.map(x=>String(x.ykiho)))];
  const statements=[];for(let i=0;i<ids.length;i+=20){const group=ids.slice(i,i+20);statements.push(db().prepare('INSERT OR IGNORE INTO institution_departments(generation,code,snapshot,institution_id) VALUES '+group.map(()=>'(?,?,?,?)').join(',')).bind(...group.flatMap(id=>[generation,code,s.snapshot,id])));}
  await batch(statements);s.total=result.total;s.received+=result.items.length;s.page++;
  if(!result.items.length&&s.received<s.total)throw new Error('정부 진료과목 일부 페이지가 누락되었습니다. 잠시 후 다시 조회해 주세요.');
  if(s.received>=s.total){const check=await db().prepare('SELECT COUNT(*) n FROM institution_departments WHERE generation=? AND code=? AND snapshot=?').bind(generation,code,s.snapshot).first<{n:number}>();if(s.received!==s.total||check?.n!==s.total)throw new Error('진료과목 기관 중복·누락 검증에 실패했습니다. 다시 조회해 주세요.');s.done=true;const present=await db().prepare('SELECT COUNT(*) n FROM institution_departments d JOIN institutions i ON i.generation=d.generation AND i.id=d.institution_id WHERE d.generation=? AND d.code=? AND d.snapshot=?').bind(generation,code,s.snapshot).first<{n:number}>();s.missing=s.total-Number(present?.n||0);}
  s.updatedAt=new Date().toISOString();await put(stateKey,JSON.stringify(s));
  // Keep the completed snapshot only. A new snapshot is never queried until verified.
  if(s.done)await db().prepare('DELETE FROM institution_departments WHERE (generation,code,snapshot,institution_id) IN (SELECT generation,code,snapshot,institution_id FROM institution_departments WHERE code=? AND (generation<>? OR snapshot<>?) LIMIT 3000)').bind(code,generation,s.snapshot).run();
  return s;
 }catch(e){const error=e instanceof Error?e.message:'진료과목을 조회할 수 없습니다.';await put(stateKey,JSON.stringify({...s,error,done:false,updatedAt:new Date().toISOString()}));throw e;}
 finally{await put(lockKey,'0');}
}
