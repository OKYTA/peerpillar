import {readJson,writeJson} from './storage';
export async function sendUpdate(to:string,subject:string,text:string,key:string){
 if(!process.env.RESEND_API_KEY||!process.env.EMAIL_FROM)return 'Email delivery is not configured.';
 const path='mail/'+key+'.json';if((await readJson<{sent:boolean}>(path))?.value.sent)return null;
 try{const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify({from:process.env.EMAIL_FROM,to:[to],subject,text}),signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('Delivery failed');const row=await readJson(path);await writeJson(path,{sent:true},row?.etag);return null}catch{return 'Saved, but email delivery failed. Please check your workspace for updates.'}
}
