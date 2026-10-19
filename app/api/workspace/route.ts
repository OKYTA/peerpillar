import {sendUpdate} from '../../../lib/email';
import {getDemoUser as getChatGPTUser} from '../../../lib/session';
import {readJson,writeJson,workspacePath,fileMetaPath} from '../../../lib/storage';
import {emptyWorkspace,normalizeWorkspace,PLATFORM_RATE,mentors,opportunities,type Workspace} from '../../data';
export const dynamic='force-dynamic';
const reply=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){try{const u=await getChatGPTUser();if(!u)return reply({error:'Unable to open workspace.'},401);const row=await readJson<{data:Workspace;version:number}>(workspacePath(u.userId));return reply({data:normalizeWorkspace(row?.value.data??emptyWorkspace),user:{name:u.fullName,email:u.email,role:u.role}});}catch{return reply({error:'Workspace storage is temporarily unavailable. Please try again.'},503)}}
export async function POST(req:Request){
 const u=await getChatGPTUser();if(!u)return reply({error:'Please sign in.'},401);
 if(req.headers.get('origin')&&new URL(req.headers.get('origin')!).host!==new URL(req.url).host)return reply({error:'Invalid origin.'},403);
 try{
 const raw=await req.text();if(raw.length>200000)return reply({error:'Request too large.'},413);const b=JSON.parse(raw);
 const staff=['complete','link','reviewStatus','note','deleteNote','feedback','audio','availability'];
 if(staff.includes(b.action)&&!['Mentor','Admin'].includes(u.role))return reply({error:'Mentor access required.'},403);
 if(b.action==='resolve'&&u.role!=='Admin')return reply({error:'Admin access required.'},403);
 if(['book','review','rate'].includes(b.action)&&u.role!=='Student')return reply({error:'Student access required.'},403);
 const row=await readJson<{data:Workspace;version:number}>(workspacePath(u.userId));const version=row?.value.version??0;
 const s:Workspace=normalizeWorkspace(row?.value.data??structuredClone(emptyWorkspace));
 const id=()=>crypto.randomUUID();const notify=(text:string)=>s.notifications.unshift({id:id(),text,read:false});
 const str=(v:unknown,max=1000)=>typeof v==='string'?v.trim().slice(0,max):'';
 const validDate=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+'T12:00:00Z'));
 switch(b.action){
 case 'profile':{
 const p=b.profile;if(!p||!str(p.name,60)||!['8','9','10','11','12','Gap year','Undergraduate','Other'].includes(p.grade)||!['IELTS','SAT','University Admissions','International Programs'].includes(p.track)||!validDate(p.date)||new Date(p.date+'T23:59:59Z').getTime()<Date.now()||!Number.isInteger(p.hours)||p.hours<1||p.hours>30)throw Error('Please check your name, grade, goal date and study hours.');
 if(p.track==='IELTS'&&(!(Number(p.current)>=0&&Number(p.current)<=9)||!(Number(p.target)>=1&&Number(p.target)<=9)))throw Error('IELTS bands must be between 0 and 9.');
 if(p.track==='SAT'&&(!(Number(p.current)>=400&&Number(p.current)<=1600)||!(Number(p.target)>=400&&Number(p.target)<=1600)))throw Error('SAT scores must be between 400 and 1600.');
 const selected=Array.isArray(p.tracks)?[...new Set(p.tracks)]:[p.track];if(!selected.length||selected.some(t=>!['IELTS','SAT','University Admissions','International Programs'].includes(t as string)))throw Error('Choose your tracks.');
 const scores:Record<string,{current:string;target:string}>={};for(const t of selected as string[]){if(t!=='IELTS'&&t!=='SAT')continue;const v=p.scores?.[t]||(t===p.track?{current:p.current,target:p.target}:null);if(!v||!Number.isFinite(Number(v.current))||!Number.isFinite(Number(v.target))||Number(v.current)<(t==='IELTS'?0:400)||Number(v.current)>(t==='IELTS'?9:1600)||Number(v.target)<(t==='IELTS'?1:400)||Number(v.target)>(t==='IELTS'?9:1600))throw Error('Check your '+t+' scores.');scores[t]={current:str(v.current,20),target:str(v.target,20)}}
 const list=(v:unknown)=>Array.isArray(v)?v.filter((x:unknown)=>typeof x==='string').slice(0,15).map((x:string)=>str(x,100)):[];
 if(JSON.stringify(s.profile?.tracks||[s.profile?.track])!==JSON.stringify(selected))s.checked=[];
 s.profile={tracks:selected as string[],purposes:list(p.purposes),stages:list(p.stages),goals:list(p.goals),scores,name:str(p.name,60),grade:p.grade,track:p.track,current:str(p.current,100),target:str(p.target,100),purpose:str(p.purpose,300),date:p.date,hours:p.hours};break;}
 case 'book':{
 if(!mentors.some(m=>m.id===b.mentorId)||!validDate(b.date)||!s.availability.includes(b.time)||!str(b.topic))throw Error('Choose a mentor, an available time and a session topic.');
 const when=new Date(b.date+'T'+b.time+':00+05:00');if(when.getTime()<Date.now()+3600000)throw Error('Please book at least one hour ahead.');
 if(s.bookings.some(x=>x.date===b.date&&x.time===b.time&&x.status!=='Cancelled'))throw Error('You already have a session at that time.');
 s.bookings.push({id:id(),mentorId:b.mentorId,date:b.date,time:b.time,topic:str(b.topic,500),price:mentors.find(m=>m.id===b.mentorId)!.price,platformRate:PLATFORM_RATE,status:'Confirmed'});notify('Session booked. Find it in My sessions. All times are Asia/Tashkent (UTC+5).');break;}
 case 'cancel':{const x=s.bookings.find(x=>x.id===b.id);if(!x||x.status!=='Confirmed')throw Error('Only upcoming sessions can be cancelled.');x.status='Cancelled';notify('Session cancelled. No demo payment was collected.');break;}
 case 'complete':{const x=s.bookings.find(x=>x.id===b.id);if(!x||x.status!=='Confirmed')throw Error('Session cannot be completed.');x.status='Completed';notify('Session completed. Leave a review when you are ready.');break;}
 case 'link':{const x=s.bookings.find(x=>x.id===b.id);const url=new URL(b.link);if(!x||url.protocol!=='https:')throw Error('Enter a secure https meeting link.');x.link=url.href;notify('Your mentor added the meeting link.');break;}
 case 'rate':{const x=s.bookings.find(x=>x.id===b.id);if(!x||x.status!=='Completed'||![1,2,3,4,5].includes(b.rating))throw Error('Complete a session before rating it.');x.rating=b.rating;x.comment=str(b.comment,500);break;}
 case 'review':{
 if(!['IELTS','SAT','University Admissions','International Programs'].includes(b.track)||!str(b.title,120)||(!str(b.text,30000)&&!b.file))throw Error('Add a title and your draft or attachment.');
 if(!mentors.some(m=>m.id===b.mentorId&&m.track===b.track))throw Error('Select a mentor in this track.');
 if(b.file){if(!/^[a-f0-9-]{36}$/.test(b.file.id))throw Error('Invalid attachment.');const f=await readJson<{id:string;name:string;mime:string}>(fileMetaPath(u.userId,b.file.id));if(!f)throw Error('Attachment not found.');b.file={id:f.value.id,name:f.value.name};}
 s.reviews.unshift({id:id(),title:str(b.title,120),track:b.track,text:str(b.text,30000),file:b.file,status:'Submitted',mentorId:b.mentorId,notes:[]});notify('Your work was submitted. Track feedback in Review studio.');break;}
 case 'reviewStatus':{const r=s.reviews.find(x=>x.id===b.id);if(!r)throw Error('Review not found.');if(!['In review','Submitted'].includes(b.status))throw Error('Invalid status.');r.status=b.status;break;}
 case 'note':{const r=s.reviews.find(x=>x.id===b.id);if(!r||!str(b.text)||!['TR','CC','LR','GRA','Reasoning','Trap','Method','Voice','Structure','Reflection'].includes(b.category))throw Error('Add an annotation and category.');r.notes.push({id:id(),category:b.category,quote:str(b.quote,500),text:str(b.text,2000)});r.status='In review';break;}
 case 'deleteNote':{const r=s.reviews.find(x=>x.id===b.id);if(!r)throw Error('Review not found.');r.notes=r.notes.filter(x=>x.id!==b.noteId);break;}
 case 'feedback':{const r=s.reviews.find(x=>x.id===b.id);if(!r||!str(b.feedback))throw Error('Write feedback before sending it.');r.feedback=str(b.feedback,5000);r.score=str(b.score,60);r.status='Feedback ready';notify('Feedback ready: '+r.title);break;}
 case 'audio':{const r=s.reviews.find(x=>x.id===b.id);if(!r)throw Error('Review not found.');if(!/^[a-f0-9-]{36}$/.test(b.file?.id))throw Error('Invalid attachment.');const f=await readJson<{id:string;name:string;mime:string}>(fileMetaPath(u.userId,b.file.id));if(!f||!f.value.mime.startsWith('audio/'))throw Error('Audio attachment not found.');r.audio={id:f.value.id,name:f.value.name};break;}
 case 'save':{if(!opportunities.some(x=>x.id===b.id))throw Error('Opportunity not found.');s.saved=s.saved.includes(b.id)?s.saved.filter(x=>x!==b.id):[...s.saved,b.id];break;}
 case 'task':{if(!str(b.text,200)||!validDate(b.date))throw Error('Enter a task and valid date.');s.tasks.push({id:id(),text:str(b.text,200),date:b.date,done:false});break;}
 case 'toggleTask':{const x=s.tasks.find(x=>x.id===b.id);if(x)x.done=!x.done;break;}
 case 'deleteTask':s.tasks=s.tasks.filter(x=>x.id!==b.id);break;
 case 'check':{if(!s.profile||!/^\d+$/.test(b.id)||Number(b.id)>=((s.profile.tracks?.length||1)*4))throw Error('Unknown milestone.');s.checked=s.checked.includes(b.id)?s.checked.filter(x=>x!==b.id):[...s.checked,b.id];break;}
 case 'read':s.notifications.forEach(x=>x.read=true);break;
 case 'availability':{if(!Array.isArray(b.times)||!b.times.length||b.times.some((x:string)=>!/^([01]\d|2[0-3]):[0-5]\d$/.test(x)))throw Error('Choose at least one valid time.');s.availability=[...new Set(b.times)] as string[];break;}
 case 'complaint':if(!str(b.text))throw Error('Tell us what happened.');s.complaints.unshift({id:id(),text:str(b.text,2000),status:'Open'});break;
 case 'resolve':{const x=s.complaints.find(x=>x.id===b.id);if(x)x.status='Resolved';break;}
 default:throw Error('Unknown action.');
 }
 s.notifications=s.notifications.slice(0,100);
 if(!await writeJson(workspacePath(u.userId),{data:s,version:version+1},row?.etag))return reply({error:'Your workspace changed. Refresh and try again.'},409);
 let emailWarning:string|null=null;if(['book','cancel','review','profile'].includes(b.action)){const subject=({book:'Session booked',cancel:'Session cancelled',review:'Submission received',profile:'Your plan is ready'} as Record<string,string>)[b.action];emailWarning=await sendUpdate(u.email,'PeerPillar · '+subject,subject+'. Open '+(process.env.APP_URL||'https://peerpillar.vercel.app')+' to view your workspace.',u.userId+'-'+(version+1));}
 return reply({data:s,emailWarning});
 }catch(e){return reply({error:e instanceof Error?e.message:'Unable to save. Please try again.'},400)}
}
