import { env } from 'cloudflare:workers';
import { XMLParser } from 'fast-xml-parser';
import {db,setting,put,batch} from '../../../lib/database';
import {normalizeItem,norm,candidateMatch,REGIONS} from '../../../lib/medical';
import {businessNo} from '../../../lib/business';
import {matchCustomer,linkStatement} from '../../../lib/customer-match';
import {repairMergedRegions} from '../../../lib/region-repair';
import {recommend} from '../../../lib/recommend';
import {addressRegion} from '../../../lib/matching-rules';
import {departmentName,departmentFilter} from '../../../lib/departments';
import {ensureDepartment} from '../../../lib/department-cache';
import {canManage} from '../../../lib/access';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const cols=['id','name','kind','category','sido','sigungu','dong','address','phone','lat','lng','name_norm','address_norm','phone_norm'];
async function key(){return (env as any).HIRA_SERVICE_KEY||await setting('api_key');}
async function apiPage(kind:string,page:number,k:string,department='',pageSize=1000){
 const service=kind==='약국'?'pharmacyInfoService/getParmacyBasisList':'hospInfoServicev2/getHospBasisList';
 const url=new URL('https://apis.data.go.kr/B551182/'+service);let decoded=k;try{decoded=decodeURIComponent(k);}catch{}url.searchParams.set('ServiceKey',decoded);url.searchParams.set('pageNo',String(page));url.searchParams.set('numOfRows',String(pageSize));if(department)url.searchParams.set('dgsbjtCd',department);
 const r=await fetch(url,{signal:AbortSignal.timeout(25000)});if(!r.ok)throw new Error('공공 API 응답 오류 ('+r.status+'). 활용승인과 서비스 이용 권한을 확인해 주세요.');
 const raw=await r.text();const parsed=new XMLParser({parseTagValue:false}).parse(raw);const response=parsed.response;if(!response||String(response.header?.resultCode)!=='00')throw new Error('공공 API 연결 실패. 인증키, 병원·약국 두 서비스의 활용승인, 일일 호출 한도를 확인해 주세요.');
 const total=Number(response.body?.totalCount);if(!Number.isFinite(total))throw new Error('공공 API 전체 건수를 확인할 수 없습니다.');let items=response.body?.items?.item||[];if(!Array.isArray(items))items=[items];return {total,items};
}
export async function GET(request:Request){try{
 await repairMergedRegions();
 const owner=await canManage(request);const u=new URL(request.url),mode=u.searchParams.get('mode');const g=await setting('active_generation'),v=await setting('active_import');
 if(mode==='status')return json({configured:!!await key(),updatedAt:await setting('updated_at'),sync:JSON.parse(await setting('sync')||'null'),import:owner?JSON.parse(await setting('import_meta')||'null'):null,activeImport:owner?v:null,activeGeneration:owner?g:null,rematch:owner?JSON.parse(await setting('rematch_progress')||'null'):null,canManage:owner,ready:!!g});
 if(mode==='link-search'){if(!owner)return json({error:'비밀번호 확인 후 이용해 주세요.'},403);const q=(u.searchParams.get('q')||'').trim();if(q.length<2)return json({rows:[]});const r=await db().prepare('SELECT id,name,kind,category,address,phone FROM institutions WHERE generation=? AND (name LIKE ? OR address LIKE ? OR id=?) ORDER BY name LIMIT 30').bind(g,'%'+q+'%','%'+q+'%',q).all();return json({rows:r.results});}
 if(mode==='recommendations'){if(!owner)return json({error:'비밀번호 확인 후 이용해 주세요.'},403);const after=Math.max(0,Number(u.searchParams.get('after'))||0);const rows=await db().prepare('SELECT * FROM customers WHERE version=? AND row>? AND institution_id IS NULL ORDER BY row LIMIT 21').bind(v,after).all();const page=(rows.results as any[]).slice(0,20);const results=[];for(const row of page)results.push({row:row.row,business_no:row.business_no,name:row.name,address:row.address,phone:row.phone,conflict:row.conflict,matchingRegion:addressRegion(row.address),candidates:await recommend(row,g)});return json({rows:results,version:v,next:rows.results.length>20?page.at(-1)?.row:null});}
 if(mode==='customers'){if(!owner)return json({error:'거래처 정보는 비밀번호 확인 후 조회할 수 있습니다.'},403);const rows=await db().prepare('SELECT row,name,company,companies,address,phone,kind,status,source_id,business_no,duplicate_count,conflict,source_codes,institution_id FROM customers WHERE version=? ORDER BY row LIMIT 20000').bind(v).all();return json({rows:rows.results.map((r:any)=>({...r,encrypted_ykiho:r.institution_id||''}))});}
 const departmentCode=u.searchParams.get('department')||'';let department:any=null;
 if(departmentCode){if(!departmentName(departmentCode))return json({error:'진료과목을 다시 선택해 주세요.'},400);if(!g)return json({error:'전국 공공 데이터를 먼저 연결해 주세요.'},400);const k=await key();if(!k)return json({error:'공공 API 인증키가 필요합니다.'},400);department=await ensureDepartment(departmentCode,g,page=>apiPage('병·의원',page,k,departmentCode));if(!department.done)return json({pending:true,department:{code:departmentCode,name:department.name,received:department.received,total:department.total,done:false},ready:false});}
 const params:any[]=[g,v];let where='i.generation=?';for(const field of ['sido','sigungu','dong','kind','category']){const value=u.searchParams.get(field);if(value){if(field==='category'&&(value==='상급종합병원'||value==='상급종합')){where+=' AND i.category IN (?,?)';params.push('상급종합병원','상급종합');}else{where+=' AND i.'+field+'=?';params.push(value);}}}
 if(department){const filter=departmentFilter(department.snapshot,departmentCode);where+=filter.sql;params.push(...filter.args);}
 const company=u.searchParams.get('company')||'';
 const base=` FROM institutions i LEFT JOIN (SELECT DISTINCT institution_id FROM customers WHERE version=? ${company?"AND (company=? OR EXISTS (SELECT 1 FROM json_each(customers.companies) WHERE value=?))":''} AND institution_id IS NOT NULL) c ON i.id=c.institution_id WHERE ${where}`;
 // The join's import binding precedes the generation binding in SQL.
 const args:any[]=[v,...(company?[company,company]:[]),g,...params.slice(2)];
 const totals=await db().prepare(`SELECT COUNT(*) total, COALESCE(SUM(i.kind='약국'),0) pharmacy,COALESCE(SUM(i.kind='병·의원'),0) hospital,COUNT(c.institution_id) covered`+base).bind(...args).first();
 const level=u.searchParams.get('level')|| (u.searchParams.get('sigungu')?'dong':u.searchParams.get('sido')?'sigungu':'sido');const group=['sido','sigungu','dong'].includes(level)?level:'sido';
 const groups=await db().prepare(`SELECT i.sido,i.sigungu,i.${group} label,COUNT(*) total,SUM(i.kind='약국') pharmacy,SUM(i.kind='병·의원') hospital,COUNT(c.institution_id) covered`+base+` GROUP BY i.sido,${group==='sido'?'i.sido':group==='sigungu'?'i.sigungu':'i.sigungu,i.dong'} ORDER BY total DESC`).bind(...args).all();
 const search=u.searchParams.get('q')||'';const status=u.searchParams.get('status')||'';let extra='';const extraArgs:any[]=[];if(search){extra+=' AND (i.name LIKE ? OR i.address LIKE ? OR i.id=?'+(owner?' OR EXISTS(SELECT 1 FROM customers b WHERE b.version=? AND b.institution_id=i.id AND b.business_no=?)':'')+')';extraArgs.push('%'+search+'%','%'+search+'%',search,...(owner?[v,businessNo(search)]:[]));}if(status==='covered')extra+=' AND c.institution_id IS NOT NULL';if(status==='open')extra+=' AND c.institution_id IS NULL';
 const page=Math.max(1,Number(u.searchParams.get('page')||1)||1);
 const count=await db().prepare('SELECT COUNT(*) n'+base+extra).bind(...args,...extraArgs).first<{n:number}>();
 const businessField=owner?`,(SELECT GROUP_CONCAT(DISTINCT b.business_no) FROM customers b WHERE b.version=? AND b.institution_id=i.id AND b.business_no<>'') business_no`:'';
 const rows=await db().prepare('SELECT i.id,i.name,i.kind,i.category,i.sido,i.sigungu,i.dong,i.address,i.phone,i.lat,i.lng,(c.institution_id IS NOT NULL) covered'+businessField+base+extra+' ORDER BY i.name LIMIT 20 OFFSET ?').bind(...(owner?[v]:[]),...args,...extraArgs,(page-1)*20).all();
 const regions=await db().prepare('SELECT DISTINCT sido,sigungu,dong FROM institutions WHERE generation=? ORDER BY sido,sigungu,dong').bind(g).all();
 const unclassified=await db().prepare('SELECT COUNT(*) n FROM institutions WHERE generation=? AND sido NOT IN ('+REGIONS.map(()=>'?').join(',')+')').bind(g,...REGIONS).first<{n:number}>();
 const categories=await db().prepare("SELECT DISTINCT category FROM institutions WHERE generation=? AND kind='병·의원' ORDER BY category").bind(g).all();
 const imports=owner?await db().prepare("SELECT COUNT(*) total,COALESCE(SUM(c.duplicate_count),0) source_total,COALESCE(SUM(c.duplicate_count-1),0) duplicates,COALESCE(SUM(i.id IS NOT NULL),0) matched,COALESCE(SUM(i.id IS NULL),0) unmatched,COUNT(DISTINCT CASE WHEN i.kind='약국' THEN i.id END) pharmacy_matched,COUNT(DISTINCT CASE WHEN i.kind='병·의원' THEN i.id END) hospital_matched FROM customers c LEFT JOIN institutions i ON i.id=c.institution_id AND i.generation=? WHERE c.version=?").bind(g,v).first():null;
 const companies=await db().prepare('SELECT DISTINCT company FROM (SELECT company FROM customers WHERE version=? UNION SELECT j.value company FROM customers c,json_each(c.companies) j WHERE c.version=?) ORDER BY company').bind(v,v).all();
 return json({department:department?{code:departmentCode,name:department.name,total:department.total,missing:department.missing||0,done:true,updatedAt:department.updatedAt}:null,totals,groups:groups.results,rows:rows.results,count:count?.n||0,regions:regions.results,categories:categories.results,imports,unclassified:unclassified?.n||0,companies:companies.results,updatedAt:await setting('updated_at'),ready:!!g});
 }catch(e){console.error('Data read failed');return json({error:e instanceof Error?e.message:'조회에 실패했습니다.'},503);}}
export async function POST(request:Request){try{
 if(Number(request.headers.get('Content-Length')||0)>3000000)return json({error:'한 번에 전송하는 데이터가 너무 큽니다.'},413);
 const origin=request.headers.get('Origin');if(origin&&origin!==new URL(request.url).origin)return json({error:'사이트 안에서 다시 시도해 주세요.'},403);
 if(!await canManage(request))return json({error:'거래처 업데이트와 데이터 관리는 비밀번호 확인 후 이용해 주세요.'},403);
 const p:any=await request.json();if(p.action==='key'){if(typeof p.key!=='string'||p.key.length<20||p.key.length>500)return json({error:'공공데이터포털 인증키를 입력해 주세요.'},400);await apiPage('약국',1,p.key);await apiPage('병·의원',1,p.key);await put('api_key',p.key);return json({ok:true});}
 if(p.action==='sync'){
  const k=await key();if(!k)return json({error:'공공데이터포털에서 병원정보서비스와 약국정보서비스 활용신청 후 인증키를 등록해 주세요.'},400);
  const now=Date.now();const lock=await db().prepare("INSERT INTO settings(key,value) VALUES('sync_lock',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(settings.value AS INTEGER)<?").bind(String(now+60000),now).run();if(lock.meta.changes!==1)return json({error:'다른 창에서 갱신 중입니다. 잠시 후 다시 시도해 주세요.'},409);
  try{let s=JSON.parse(await setting('sync')||'null');
   if(s?.done&&p.runId&&s.runId===p.runId)return json(s);
   const fresh=!s||s.done;
   if(fresh)s={generation:crypto.randomUUID(),runId:String(p.runId||''),kind:'약국',page:1,pageSize:100,received:0,total:null,done:false,startedAt:new Date().toISOString()};
   // Older checkpoints used 1,000-row pages. Preserve committed rows and resume with 100-row pages.
   if(s.pageSize!==100){if(s.received%100!==0)throw new Error('이전 진행 위치를 변환할 수 없습니다. 수집 상태를 초기화해 주세요.');s.pageSize=100;s.page=Math.floor(s.received/100)+1;}
   s.runId=String(p.runId||s.runId||'');
   const result=await apiPage(s.kind,s.page,k,'',100);if(s.total!==null&&s.total!==result.total)throw new Error('갱신 중 공공 API의 전체 건수가 변경되었습니다. 수집 상태를 초기화한 뒤 다시 시작해 주세요.');
   const items=result.items.map((x:any)=>normalizeItem(x,s.kind));if(items.length>100)throw new Error('공공 API가 요청한 페이지 크기를 초과했습니다.');if(items.some((x:any)=>!x.id||!x.name))throw new Error('기관 식별번호가 누락된 데이터가 있어 갱신을 완료할 수 없습니다.');
   const statements=[];for(let i=0;i<items.length;i+=6){const group=items.slice(i,i+6);statements.push(db().prepare(`INSERT OR REPLACE INTO institutions(generation,${cols.join(',')}) VALUES ${group.map(()=> '('+Array(15).fill('?').join(',')+')').join(',')}`).bind(...group.flatMap((x:any)=>[s.generation,...cols.map(c=>x[c])])));}
   s.total=result.total;s.received+=items.length;s.page++;s.updatedAt=new Date().toISOString();
   if(s.received>=s.total){if(s.received!==s.total)throw new Error('기관 건수 검증에 실패했습니다.');if(s.kind==='약국'){s.pharmacyTotal=s.total;s.kind='병·의원';s.page=1;s.received=0;s.total=null;}else{
    s.done=true;
   }}else if(!items.length)throw new Error('공공 API에서 일부 페이지가 비어 있습니다. 전체 갱신은 완료되지 않았습니다.');
   if(s.done){
    // Fail the whole batch if total unique IDs differ. No partial page or active-generation flip survives.
    statements.push(db().prepare("INSERT INTO settings(key,value) SELECT 'sync_validation',NULL WHERE (SELECT COUNT(*) FROM institutions WHERE generation=?)<>?").bind(s.generation,s.pharmacyTotal+s.total));
    statements.push(db().prepare("INSERT INTO settings(key,value) VALUES('active_generation',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(s.generation));
    statements.push(db().prepare("INSERT INTO settings(key,value) VALUES('updated_at',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(s.updatedAt));
   }
   statements.push(db().prepare("INSERT INTO settings(key,value) VALUES('sync',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(JSON.stringify(s)));
   await db().batch(statements);
   return json(s);
  }finally{await put('sync_lock','0');}
 }
 if(p.action==='reset-sync'){await put('sync','null');return json({ok:true});}
 if(p.action==='import-start'){const id=crypto.randomUUID();if(!Number.isInteger(p.total)||p.total<1||p.total>20000)return json({error:'1~20,000행까지 등록할 수 있습니다.'},400);await put('upload_'+id,JSON.stringify({total:p.total,sourceTotal:Number(p.sourceTotal)||p.total,name:String(p.name||'엑셀').slice(0,150),at:new Date().toISOString()}));return json({version:id});}
 if(p.action==='import-chunk'){
  const meta=await setting('upload_'+p.version);if(!meta||!Array.isArray(p.rows)||p.rows.length>100)return json({error:'업로드 요청이 올바르지 않습니다.'},400);const g=await setting('active_generation');const statements=[];const report=[];
  for(const row of p.rows){const b=businessNo(row.businessNo);if(!/^\d{10}$/.test(b)||!Number.isInteger(row.row)||row.row<1||row.row>JSON.parse(meta).total)return json({error:'사업자등록번호는 숫자 10자리로 입력해 주세요.'},400);
   const match=await matchCustomer({...row,businessNo:b},g);const inst:any=match.institution;const companies=Array.isArray(row.companies)?[...new Set(row.companies.map((c:any)=>String(c).slice(0,100)))].slice(0,50):[String(row.company||'동원약품그룹')];const sourceCodes=Array.isArray(row.sourceCodes)?row.sourceCodes.map((c:any)=>String(c).slice(0,500)).slice(0,50):[String(row.id||'')];
   statements.push(db().prepare('INSERT INTO customers(version,row,name,company,address,phone,kind,source_id,business_no,companies,duplicate_count,conflict,source_codes,institution_id,status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(version,row) DO UPDATE SET name=excluded.name,company=excluded.company,address=excluded.address,phone=excluded.phone,kind=excluded.kind,source_id=excluded.source_id,business_no=excluded.business_no,companies=excluded.companies,duplicate_count=excluded.duplicate_count,conflict=excluded.conflict,source_codes=excluded.source_codes,institution_id=excluded.institution_id,status=excluded.status').bind(p.version,row.row,String(row.name||inst?.name||'미입력').slice(0,200),String(row.company||'동원약품그룹').slice(0,100),String(row.address||inst?.address||'').slice(0,500),String(row.phone||inst?.phone||'').slice(0,40),String(inst?.kind||row.kind||''),String(row.id||'').slice(0,500),b,JSON.stringify(companies),Math.max(1,Math.min(20000,Number(row.duplicateCount)||1)),row.conflict?1:0,JSON.stringify(sourceCodes),match.id,match.status));report.push({row:row.row,...match});
  }await batch(statements);return json({report:report.map(({institution,...r}:any)=>r)});
 }
 if(p.action==='import-commit'){const raw=await setting('upload_'+p.version);if(!raw)return json({error:'업로드를 찾을 수 없습니다.'},400);const meta=JSON.parse(raw);const c=await db().prepare('SELECT COUNT(*) n FROM customers WHERE version=?').bind(p.version).first<{n:number}>();if(c?.n!==meta.total)return json({error:'일부 행이 저장되지 않았습니다. 다시 업로드해 주세요.'},400);
  const matches=await db().prepare("SELECT business_no,source_id,institution_id FROM customers WHERE version=? AND institution_id IS NOT NULL AND business_no<>'' AND conflict=0").bind(p.version).all();await batch((matches.results as any[]).map(r=>linkStatement(r.business_no,r.source_id,r.institution_id)));
  await db().batch([db().prepare("INSERT INTO settings(key,value) VALUES('active_import',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(p.version),db().prepare("INSERT INTO settings(key,value) VALUES('import_meta',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(JSON.stringify(meta))]);return json({ok:true});}
 if(p.action==='rematch'){
  const g=await setting('active_generation'),v=await setting('active_import');
  if(!g||!v)return json({error:'공공 데이터와 거래처를 먼저 등록해 주세요.'},400);
  if((p.version&&p.version!==v)||(p.generation&&p.generation!==g))return json({error:'대조 중 거래처 파일 또는 공공 데이터가 변경되었습니다. 다시 대조해 주세요.'},409);
  const offset=Math.max(0,Math.floor(Number(p.offset)||0));
  const previous=JSON.parse(await setting('rematch_progress')||'null');
  const totalRow=await db().prepare('SELECT COUNT(*) n FROM customers WHERE version=?').bind(v).first<{n:number}>();
  const total=Number(totalRow?.n||0),startedAt=offset&&previous?.version===v?previous.startedAt:new Date().toISOString();
  await put('rematch_progress',JSON.stringify({version:v,generation:g,total,processed:Math.min(offset,total),matched:previous?.version===v?previous.matched:0,done:false,startedAt,updatedAt:new Date().toISOString()}));
  const rows=await db().prepare('SELECT * FROM customers WHERE version=? ORDER BY row LIMIT 100 OFFSET ?').bind(v,offset).all();
  const stmts=[];
  for(const row of rows.results as any[]){const m=await matchCustomer(row,g);const inst:any=m.institution;stmts.push(db().prepare('UPDATE customers SET institution_id=?,status=?,name=?,kind=?,address=? WHERE version=? AND row=?').bind(m.id,m.status,row.name==='미입력'&&inst?inst.name:row.name,inst?.kind||row.kind,row.address||inst?.address||'',v,row.row));if(m.id&&row.business_no&&!row.conflict)stmts.push(linkStatement(row.business_no,row.source_id,m.id));}
  if(await setting('active_import')!==v||await setting('active_generation')!==g)return json({error:'대조 중 데이터가 변경되었습니다. 다시 대조해 주세요.'},409);
  await batch(stmts);
  const linked=await db().prepare('SELECT COUNT(*) n FROM customers c JOIN institutions i ON i.id=c.institution_id AND i.generation=? WHERE c.version=?').bind(g,v).first<{n:number}>();
  const processed=Math.min(offset+rows.results.length,total),done=processed>=total;
  const progress={version:v,generation:g,total,processed,matched:Number(linked?.n||0),done,startedAt,updatedAt:new Date().toISOString()};
  await put('rematch_progress',JSON.stringify(progress));
  return json({...progress,offset:processed});
 }
 if(p.action==='link-business'){const v=await setting('active_import'),g=await setting('active_generation');if(p.version&&p.version!==v)return json({error:'거래처 파일이 변경되었습니다. 후보를 다시 조회해 주세요.'},409);const row=await db().prepare('SELECT * FROM customers WHERE version=? AND row=?').bind(v,Number(p.row)).first<any>();if(!row?.business_no)return json({error:'사업자번호가 있는 거래처를 선택해 주세요.'},400);const inst=await db().prepare('SELECT * FROM institutions WHERE generation=? AND id=?').bind(g,String(p.institutionId)).first<any>();if(!inst)return json({error:'선택한 공공기관을 확인할 수 없습니다.'},400);const source=String(p.sourceId||row.source_id||'').trim();const codes=JSON.parse(row.source_codes||'[]');if(row.conflict&&(!source||!codes.includes(source)))return json({error:'중복 행에서 사용할 요양기호를 선택해 주세요.'},400);
  await db().batch([linkStatement(row.business_no,source,inst.id),db().prepare('UPDATE customers SET institution_id=?,status=?,source_id=?,conflict=0,name=?,kind=?,address=?,phone=? WHERE version=? AND business_no=?').bind(inst.id,'직접 확인한 기관 연결',source,row.name==='미입력'?inst.name:row.name,inst.kind,row.address||inst.address,row.phone||inst.phone,v,row.business_no)]);return json({ok:true});}
 return json({error:'지원하지 않는 요청입니다.'},400);
 }catch(e){console.error('Data update failed');return json({error:e instanceof Error?e.message:'저장에 실패했습니다. 입력 내용은 유지됩니다.'},500);}}
