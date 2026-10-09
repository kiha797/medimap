import {norm,addressNorm,phoneNorm} from './medical';
import {matchName,nameSimilarity,addressRegion,compatible} from './matching-rules';
import {matchCandidates} from './match-candidates';
const tokens=(s:string)=>new Set(String(s||'').replace(/[(),]/g,' ').split(/\s+/).filter(x=>x.length>1));
export function rankCandidates(row:any,items:any[]){return items.filter(x=>compatible(row,x)).map(x=>{const reasons:string[]=[];let score=0;const a=matchName(row.name==='미입력'?'':row.name),b=matchName(x.name);if(a&&a===b){score+=45;reasons.push('기관명 일치 (지역 메모·관리 기호 정리)');}else{const sim=nameSimilarity(row.name,x.name);if(sim>=.5){score+=Math.round(sim*30);reasons.push('기관명 유사');}}
 if(addressRegion(row.address)){score+=15;reasons.push('주소 시·도 일치');}
 const p=phoneNorm(row.phone);if(p.length>=8&&p===phoneNorm(x.phone)){score+=45;reasons.push('전화번호 일치');}
 const address=addressNorm(row.address);if(address&&address===addressNorm(x.address)){score+=50;reasons.push('주소 일치');}else{const t=tokens(row.address),u=tokens(x.address),shared=[...t].filter(v=>u.has(v));if(shared.length>=2){score+=Math.min(20,shared.length*5);reasons.push('주소 일부 일치');}}
 return {...x,score,reasons};}).filter(x=>x.score>=20).sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name)).slice(0,3);}
export async function recommend(row:any,g:string){if(row.conflict)return [];const c=await matchCandidates(row,g);return rankCandidates(row,c.items);}
