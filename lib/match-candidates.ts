import {db} from './database';
import {phoneNorm,addressNorm} from './medical';
import {matchName,nameStem,addressRegion} from './matching-rules';
export async function matchCandidates(row:any,g:string){
 const name=matchName(row.name==='미입력'?'':row.name),phone=phoneNorm(row.phone),address=addressNorm(row.address),region=addressRegion(row.address);
 const conditions:string[]=[],args:any[]=[g];
 if(region)args.push(region);
 if(name){conditions.push('(name_norm=? OR name_norm LIKE ?)');args.push(name,'%'+(nameStem(row.name)||name).replace(/[%_]/g,'')+'%');}
 if(phone.length>=8){conditions.push('phone_norm=?');args.push(phone);}
 if(address){conditions.push('address_norm=?');args.push(address);}
 if(!conditions.length)return {items:[],truncated:false};
 const result=await db().prepare('SELECT * FROM institutions WHERE generation=? '+(region?'AND sido=? ':'')+'AND ('+conditions.join(' OR ')+') ORDER BY name LIMIT 101').bind(...args).all();
 return {items:result.results as any[],truncated:result.results.length>=101};
}
