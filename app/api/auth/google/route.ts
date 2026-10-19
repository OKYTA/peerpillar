import {cookies} from 'next/headers';
import {randomBytes,createHash} from 'node:crypto';
import {seal} from '../../../../lib/session';
export const runtime='nodejs';
export async function GET(req:Request){
 if(!process.env.GOOGLE_CLIENT_ID||!process.env.GOOGLE_CLIENT_SECRET||!process.env.APP_URL||!process.env.SESSION_SECRET)return Response.json({error:'Google sign-in is not configured.'},{status:503});
 const role=new URL(req.url).searchParams.get('role')||'Student';if(!['Student','Mentor','Admin'].includes(role))return Response.json({error:'Invalid panel.'},{status:400});
 const state=randomBytes(32).toString('base64url'),verifier=randomBytes(48).toString('base64url');
 (await cookies()).set('__Host-peerpillar-oauth',seal({state,verifier,role,exp:Date.now()+600000}),{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:600});
 const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');url.search=new URLSearchParams({client_id:process.env.GOOGLE_CLIENT_ID,redirect_uri:process.env.APP_URL+'/api/auth/callback',response_type:'code',scope:'openid email profile',state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',prompt:'select_account'}).toString();
 return Response.redirect(url,303);
}
