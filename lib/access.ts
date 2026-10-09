import {getChatGPTUser} from '../app/chatgpt-auth';
export async function canManage(){const user=await getChatGPTUser();return !!user&&user.email.toLowerCase()==='dongwon4@dwpw.co.kr';}
