import {REGIONS,normalizeSido,norm,phoneNorm,addressNorm} from './medical';

// Cleaning is only for comparison; the uploaded and public names remain intact.
export function matchName(value:unknown){const text=String(value||'').normalize('NFKC').trim().replace(/^[#/*◎●★!]+\s*/u,'');return norm(text.replace(/\s*\(([^()]*)\)\s*$/u,(all,memo:string)=>/지점|분점|본점|\d+호점/.test(memo)?all:''));}
export function nameStem(value:unknown){return matchName(value).replace(/약국|의원|병원/g,'');}
export function nameSimilarity(a:unknown,b:unknown){const x=nameStem(a),y=nameStem(b);if(x===y&&x)return 1;if(!x||!y)return 0;const pairs=(s:string)=>new Set(Array.from({length:Math.max(0,s.length-1)},(_,i)=>s.slice(i,i+2)));const p=pairs(x),q=pairs(y);return p.size+q.size?2*[...p].filter(v=>q.has(v)).length/(p.size+q.size):0;}
export function addressRegion(value:unknown){const s=String(value||'').normalize('NFKC').trim();const first=s.split(/\s+/)[0].replace(/\([^)]*\)/g,'').replace(/[,/]/g,'');const region=normalizeSido(first,s,s.split(/\s+/)[1]);return REGIONS.includes(region)?region:'';}
export function addressDistrict(value:unknown){const s=String(value||'').normalize('NFKC').trim();if(!addressRegion(s))return '';return s.split(/\s+/).slice(1).find(x=>/^[가-힣]+(?:시|군|구)$/.test(x))||'';}
export function rowKind(row:any){return row.kind||(/약국/.test(row.name)?'약국':/의원|병원|내과|외과|정신과|산부|이비인|치과|한의/.test(row.name)?'병·의원':'');}
export function inRegion(row:any,item:any){const region=addressRegion(row.address);return !region||(item.sido||addressRegion(item.address))===region;}
export function sameDistrict(row:any,item:any){const d=addressDistrict(row.address);if(!d)return true;const other=String(item.sigungu||addressDistrict(item.address)||'').replace(/^(광주|대구|전남)/,'');return other===d||other.includes(d)||String(item.address||'').split(/\s+/).includes(d);}
export function compatible(row:any,item:any){return (!rowKind(row)||rowKind(row)===item.kind)&&inRegion(row,item)&&sameDistrict(row,item);}
export function chooseMatch(row:any,items:any[],truncated=false){
 if(truncated)return {id:null,status:'후보 다수 · 기관 확인 필요',institution:null};
 const pool=items.filter(x=>compatible(row,x));
 const name=matchName(row.name==='미입력'?'':row.name),phone=phoneNorm(row.phone),address=addressNorm(row.address);
 const named=(x:any)=>!!name&&name===matchName(x.name);
 const phoneExact=(x:any)=>phone.length>=8&&phone===phoneNorm(x.phone);
 const addressExact=(x:any)=>!!address&&address===addressNorm(x.address);
 // Contradictory known telephone evidence prevents name+region-only confirmation.
 const phoneOkay=(x:any)=>phone.length<8||phoneNorm(x.phone).length<8||phoneExact(x);
 const strong=pool.filter(x=>phoneOkay(x)&&((named(x)&&(phoneExact(x)||addressExact(x)))||(phoneExact(x)&&addressExact(x))||(phoneExact(x)&&nameSimilarity(row.name,x.name)>=.6)));
 if(strong.length===1)return {id:strong[0].id,status:'기관명·주소·전화 대조로 매칭',institution:strong[0]};
 if(strong.length>1)return {id:null,status:'동일 정보의 기관 다수 · 확인 필요',institution:null};
 if(addressRegion(row.address)){
  const exact=pool.filter(named);
  if(exact.length===1&&phoneOkay(exact[0]))return {id:exact[0].id,status:'기관명·주소 지역 유일 일치로 매칭',institution:exact[0]};
  if(exact.length>1)return {id:null,status:'동일 지역·기관명 중복 · 확인 필요',institution:null};
 }
 return {id:null,status:'기관 연결 필요',institution:null};
}
