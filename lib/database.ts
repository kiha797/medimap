import { env } from 'cloudflare:workers';
export function db():D1Database{const value=(env as any).DB;if(!value)throw new Error('데이터 저장소를 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.');return value;}
export async function setting(key:string){const v=await db().prepare('SELECT value FROM settings WHERE key=?').bind(key).first<{value:string}>();return v?.value||'';}
export async function put(key:string,value:string){await db().prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(key,value).run();}
export async function batch(statements:D1PreparedStatement[]){for(let i=0;i<statements.length;i+=80)await db().batch(statements.slice(i,i+80));}
