import {cookies} from 'next/headers';
import {createHash} from 'node:crypto';
import {unseal,seal,SESSION_COOKIE,type Account,type Role} from '../../../../lib/session';
import {readJson,writeJson} from '../../../../lib/storage';
export const runtime='nodejs';
export async function GET(req:Request){const jar=await cookies();const origin=process.env.APP_URL;if(!origin)return Response.json({error:'Sign-in is not configured.'},{status:503});try{
 const url=new URL(req.url),flow=unseal<{state:string;verifier:string;role:Role;exp:number}>(jar.get('__Host-peerpillar-oauth')?.value||'');jar.delete('__Host-peerpillar-oauth');
 if(!flow||url.searchParams.get('state')!==flow.state||!url.searchParams.get('code'))throw Error('Invalid sign-in');
 const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({code:url.searchParams.get('code')!,client_id:process.env.GOOGLE_CLIENT_ID!,client_secret:process.env.GOOGLE_CLIENT_SECRET!,redirect_uri:origin+'/api/auth/callback',grant_type:'authorization_code',code_verifier:flow.verifier}),signal:AbortSignal.timeout(10000)});const token=await response.json();if(!response.ok||!token.access_token)throw Error('Token exchange failed');
 const info=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:'Bearer '+token.access_token},cache:'no-store',signal:AbortSignal.timeout(10000)});const user=await info.json();if(!info.ok||!user.sub||!user.email||user.email_verified!==true)throw Error('Verified email required');
 const userId=createHash('sha256').update('google:'+user.sub).digest('hex'),path='accounts/'+userId+'.json';let account=(await readJson<Account>(path))?.value;
 if(!account){const admins=(process.env.ADMIN_EMAILS||'').toLowerCase().split(',').map(x=>x.trim());if(flow.role==='Admin'&&!admins.includes(user.email.toLowerCase()))throw Error('Admin access denied');account={userId,email:user.email.toLowerCase(),fullName:user.name||user.email.split('@')[0],role:flow.role};if(!await writeJson(path,account)){account=(await readJson<Account>(path))?.value;if(!account)throw Error('Account creation failed')}}
 if(account.role!==flow.role)throw Error('Choose your registered panel');
 jar.set(SESSION_COOKIE,seal({id:userId,exp:Date.now()+30*86400000}),{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:30*86400});return Response.redirect(origin,303);
 }catch{return Response.redirect(origin+'/?auth_error=1',303)}}
