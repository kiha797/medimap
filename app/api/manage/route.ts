import {env} from 'cloudflare:workers';
import {db,put} from '../../../lib/database';
import {digest,MANAGEMENT_COOKIE} from '../../../lib/access';
const reply=(data:unknown,status=200,extra:Record<string,string>={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store',...extra}});
export async function POST(request:Request){try{
 if(request.headers.get('Origin')!==new URL(request.url).origin)return reply({error:'사이트 안에서 다시 시도해 주세요.'},403);
 if(Number(request.headers.get('Content-Length')||0)>1024)return reply({error:'입력값을 확인해 주세요.'},400);
 const configured=(env as any).ADMIN_PASSWORD;
 if(typeof configured!=='string'||!configured)return reply({error:'Cloudflare의 변수 및 비밀에 ADMIN_PASSWORD를 등록해 주세요.'},503);
 const ip=request.headers.get('CF-Connecting-IP')||'local';
 const attemptKey='management_attempt_'+await digest(ip)+':'+Math.floor(Date.now()/900000);
 const attempt=await db().prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=CAST(CAST(value AS INTEGER)+1 AS TEXT) RETURNING value').bind(attemptKey,'1').first<{value:string}>();
 if(Number(attempt?.value)>10)return reply({error:'확인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.'},429,{'Retry-After':'900'});
 const body:any=await request.json();
 if(typeof body.password!=='string'||body.password.length>200)return reply({error:'비밀번호를 확인해 주세요.'},400);
 const [actual,expected]=await Promise.all([digest(body.password),digest(configured)]);
 let mismatch=0;for(let i=0;i<actual.length;i++)mismatch|=actual.charCodeAt(i)^expected.charCodeAt(i);
 if(mismatch)return reply({error:'비밀번호가 일치하지 않습니다.'},401);
 const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
 await put('management_session_'+await digest(token),String(Date.now()+1800000));
 await db().prepare('DELETE FROM settings WHERE key=?').bind(attemptKey).run();
 await db().prepare("DELETE FROM settings WHERE key LIKE 'management_session_%' AND CAST(value AS INTEGER)<?").bind(Date.now()).run();
 await db().prepare("DELETE FROM settings WHERE key LIKE 'management_attempt_%' AND CAST(substr(key,instr(key,':')+1) AS INTEGER)<?").bind(Math.floor(Date.now()/900000)-1).run();
 return reply({ok:true},200,{'Set-Cookie':`${MANAGEMENT_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=1800${new URL(request.url).protocol==='https:'?'; Secure':''}`});
 }catch{return reply({error:'비밀번호 확인을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.'},500);}
}
