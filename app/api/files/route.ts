import {getDemoUser} from '../../../lib/session';
import {put,writeJson,filePath,fileMetaPath} from '../../../lib/storage';
export const runtime='nodejs';
export async function POST(req:Request){const u=await getDemoUser();if(!u)return Response.json({error:'Please reopen your workspace.'},{status:401});
 if(req.headers.get('origin')&&new URL(req.headers.get('origin')!).host!==new URL(req.url).host)return Response.json({error:'Invalid origin.'},{status:403});
 try{const form=await req.formData();const file=form.get('file');if(!(file instanceof File))throw Error('Choose a file.');const allowed=['application/pdf','text/plain','image/png','image/jpeg','image/webp','audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav'];const mime=file.type.split(';')[0];if(!allowed.includes(mime))throw Error('Use a PDF, TXT, PNG, JPG, WebP or audio file.');if(file.size>4*1024*1024||file.size===0)throw Error('Use a file smaller than 4 MB.');
 const id=crypto.randomUUID();await put(filePath(u.userId,id),file,{access:'private',contentType:mime,addRandomSuffix:false});await writeJson(fileMetaPath(u.userId,id),{id,name:file.name.slice(0,200),mime,size:file.size});return Response.json({id,name:file.name});}catch(e){return Response.json({error:e instanceof Error?e.message:'Upload failed.'},{status:400})}}
