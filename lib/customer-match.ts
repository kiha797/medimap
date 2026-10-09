import {db} from './database';
import {chooseMatch} from './matching-rules';
import {matchCandidates} from './match-candidates';
import {plainYoyang} from './business';
export async function matchCustomer(row:any,g:string){
 if(row.conflict)return {id:null,status:'같은 사업자번호의 요양기호 상이 · 확인 필요',institution:null};
 if(!g)return {id:null,status:'공공 데이터 연결 대기',institution:null};
 const b=row.businessNo||row.business_no||'',source=String(row.id||row.source_id||'').trim();
 if(b){const link=await db().prepare('SELECT * FROM business_links WHERE business_no=?').bind(b).first<any>();if(link){if(source&&link.source_id&&source!==link.source_id&&source!==link.institution_id)return {id:null,status:'기존 연결과 요양기호 상이 · 확인 필요',institution:null};const institution=await db().prepare('SELECT * FROM institutions WHERE generation=? AND id=?').bind(g,link.institution_id).first<any>();if(institution)return {id:institution.id,status:'사업자번호 저장 연결로 매칭',institution};}}
 if(source&&!plainYoyang(source)){const institution=await db().prepare('SELECT * FROM institutions WHERE generation=? AND id=?').bind(g,source).first<any>();if(institution)return {id:institution.id,status:'암호화 요양기호로 매칭',institution};}
 if(row.address||String(row.phone||'').replace(/\D/g,'').length>=8){const c=await matchCandidates(row,g);const m=chooseMatch(row,c.items,c.truncated);if(m.id||m.status!=='기관 연결 필요')return m;}
 return {id:null,status:plainYoyang(source)?'일반 요양기호 · 최초 기관 연결 필요':'기관 연결 필요',institution:null};
}
export function linkStatement(b:string,source:string,id:string){return db().prepare(`INSERT INTO business_links(business_no,source_id,institution_id,updated_at) VALUES(?,?,?,?) ON CONFLICT(business_no) DO UPDATE SET source_id=CASE WHEN excluded.source_id='' AND business_links.institution_id=excluded.institution_id THEN business_links.source_id ELSE excluded.source_id END,institution_id=excluded.institution_id,updated_at=excluded.updated_at`).bind(b,source,id,new Date().toISOString());}
