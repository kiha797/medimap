import {db} from './database';
import {phoneNorm,addressNorm} from './medical';
import {matchName,nameStem,addressRegion} from './matching-rules';
export async function matchCandidates(row:any,g:string){
 const name=matchName(row.name==='미입력'?'':row.name),phone=phoneNorm(row.phone),address=addressNorm(row.address),region=addressRegion(row.address);
 // Separate equality lookups let SQLite use each dedicated index instead of a broad OR scan.
 const queries:string[]=[],args:any[]=[];
 const add=(condition:string,values:any[])=>{queries.push('SELECT * FROM institutions WHERE generation=? '+(region?'AND sido=? ':'')+'AND '+condition);args.push(g,...(region?[region]:[]),...values);};
 if(name)add('name_norm=?',[name]);
 if(phone.length>=8)add('phone_norm=?',[phone]);
 if(address)add('address_norm=?',[address]);
 // Retain the existing partial-name candidates and ambiguity checks, restricted to the parsed province.
 if(name)add('name_norm LIKE ?',['%'+(nameStem(row.name)||name).replace(/[%_]/g,'')+'%']);
 if(!queries.length)return {items:[],truncated:false};
 const result=await db().prepare(queries.join(' UNION ')+' ORDER BY name LIMIT 101').bind(...args).all();
 return {items:result.results as any[],truncated:result.results.length>=101};
}
