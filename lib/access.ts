import {setting} from './database';
export const MANAGEMENT_COOKIE='medimap_management';
export async function digest(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');}
export async function canManage(request:Request){
 const token=(request.headers.get('Cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(MANAGEMENT_COOKIE+'='))?.slice(MANAGEMENT_COOKIE.length+1)||'';
 if(!/^[a-f0-9]{64}$/.test(token))return false;
 const expires=Number(await setting('management_session_'+await digest(token)));
 return Number.isFinite(expires)&&expires>Date.now();
}
