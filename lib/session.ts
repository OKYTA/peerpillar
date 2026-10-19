import {cookies} from 'next/headers';
import {createHmac,timingSafeEqual} from 'node:crypto';
import {readJson} from './storage';
export type Role='Student'|'Mentor'|'Admin';
export type Account={userId:string;fullName:string;email:string;role:Role};
export const SESSION_COOKIE='__Host-peerpillar-account';
export function seal(value:unknown){if(!process.env.SESSION_SECRET)throw Error('Session configuration unavailable');const data=Buffer.from(JSON.stringify(value)).toString('base64url');return data+'.'+createHmac('sha256',process.env.SESSION_SECRET).update(data).digest('base64url')}
export function unseal<T>(value:string):T|null{try{const [data,sig]=value.split('.');const expected=Buffer.from(seal(JSON.parse(Buffer.from(data,'base64url').toString())).split('.')[1]);const actual=Buffer.from(sig||'');if(expected.length!==actual.length||!timingSafeEqual(expected,actual))return null;const result=JSON.parse(Buffer.from(data,'base64url').toString());return result.exp>Date.now()?result:null}catch{return null}}
export async function getDemoUser(_create=false):Promise<Account|null>{const jar=await cookies();const session=unseal<{id:string;exp:number}>(jar.get(SESSION_COOKIE)?.value||'');if(!session||!/^[a-f0-9]{64}$/.test(session.id))return null;const row=await readJson<Account>('accounts/'+session.id+'.json');return row?.value||null}
