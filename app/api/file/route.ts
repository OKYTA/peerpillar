import {getDemoUser} from '../../../lib/session';
import {get,readJson,filePath,fileMetaPath,sharedPath} from '../../../lib/storage';
import type {Shared} from '../../data';
export const runtime='nodejs';
export async function GET(req:Request){const u=await getDemoUser();if(!u)return new Response('Unauthorized',{status:401});const id=new URL(req.url).searchParams.get('id')||'';if(!/^[a-f0-9-]{36}$/.test(id))return new Response('Not found',{status:404});
 // Files live under their uploader's folder; the student and mentor of a review may both open its attachment and audio feedback.
 const review=(await readJson<{data:Shared}>(sharedPath))?.value.data.reviews.find(r=>(r.studentId===u.userId||r.mentorId===u.userId)&&(r.file?.id===id||r.audio?.id===id));
 const owner=(review?.file?.id===id?review.file:review?.audio)?.owner||u.userId;
 const meta=await readJson<{name:string;mime:string}>(fileMetaPath(owner,id));if(!meta)return new Response('Not found',{status:404});const file=await get(filePath(owner,id),{access:'private'});if(!file||file.statusCode!==200)return new Response('Not found',{status:404});return new Response(file.stream,{headers:{'Content-Type':meta.value.mime,'Content-Disposition':`inline; filename*=UTF-8''${encodeURIComponent(meta.value.name)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})}
