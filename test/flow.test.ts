// End-to-end check of the Student / Mentor / Admin flow against the real route handlers (storage and cookies mocked).
import {test} from 'node:test';
import assert from 'node:assert/strict';
process.env.SESSION_SECRET='test-secret';
import {seal,SESSION_COOKIE,type Role} from '../lib/session';
import {writeJson} from '../lib/storage';
import {jar} from './mock-headers';
import {GET,POST} from '../app/api/workspace/route';
import {POST as upload} from '../app/api/files/route';
import {GET as download} from '../app/api/file/route';

const ids:Record<string,string>={};
async function login(name:string,role:Role){
 const userId=(ids[name]??=Buffer.from(name.padEnd(32,'_')).toString('hex'));
 await writeJson('accounts/'+userId+'.json',{userId,fullName:name,email:name.toLowerCase()+'@x.test',role});
 jar.set(SESSION_COOKIE,seal({id:userId,exp:Date.now()+1e6}));return userId;
}
const call=async(action:string,body:Record<string,unknown>={})=>{const r=await POST(new Request('http://t/api/workspace',{method:'POST',body:JSON.stringify({action,...body})}));return {status:r.status,json:await r.json() as any}};
const view=async()=>(await GET()).json() as Promise<any>;
const put=async(name:string,type:string,text:string)=>{const f=new FormData();f.append('file',new File([text],name,{type}));return (await upload(new Request('http://t/api/files',{method:'POST',body:f}))).json() as Promise<{id:string;name:string}>};
const open=async(id:string)=>download(new Request('http://t/api/file?id='+id));
const day=new Date(Date.now()+5*86400000).toISOString().slice(0,10);

test('mentor, student and admin share one workflow',async()=>{
 // mentor lists a profile
 const mentorId=await login('Maya','Mentor');
 assert.equal((await call('availability',{times:['10:00']})).status,400,'needs a profile first');
 assert.equal((await call('mentorProfile',{profile:{track:'IELTS',headline:'h',bio:'b',price:25,focus:['Writing',' ']}})).status,200);
 assert.equal((await call('availability',{times:['10:00','11:00','12:00']})).status,200);

 // student sees the real mentor and books; the slot is taken for everyone else
 await login('Sam','Student');
 let v=await view();
 assert.deepEqual(v.mentors.map((m:any)=>m.id),[mentorId]);
 assert.equal((await call('book',{mentorId,date:day,time:'09:00',topic:'t'})).status,400,'slot not in mentor availability');
 const booked=await call('book',{mentorId,date:day,time:'10:00',topic:'essay'});
 assert.equal(booked.status,200);
 assert.deepEqual(booked.json.mentors[0].busy,[day+'T10:00']);
 await login('Tom','Student');
 assert.equal((await call('book',{mentorId,date:day,time:'10:00',topic:'x'})).status,400,'double booking blocked');

 // simultaneous bookings: different slots must both land (retry on lost etag), the same slot only once
 await login('Sam','Student');
 const sam=call('book',{mentorId,date:day,time:'11:00',topic:'a'});
 await login('Tom','Student');
 const tom=call('book',{mentorId,date:day,time:'12:00',topic:'b'});
 assert.deepEqual((await Promise.all([sam,tom])).map(r=>r.status),[200,200]);
 await login('Sam','Student');
 const one=call('book',{mentorId,date:day,time:'09:00',topic:'c'});
 assert.equal((await one).status,400);
 await login('Tom','Student');
 assert.equal((await call('cancel',{id:(await view()).data.bookings[0].id})).status,200);
 await login('Sam','Student');
 const again=call('book',{mentorId,date:day,time:'12:00',topic:'d'});
 await login('Tom','Student');
 const same=call('book',{mentorId,date:day,time:'12:00',topic:'e'});
 assert.deepEqual((await Promise.all([again,same])).map(r=>r.status).sort(),[200,400]);

 // mentor sees Sam's booking, completes it; Sam can then rate it
 await login('Maya','Mentor');
 v=await view();
 const mine=v.data.bookings.find((b:any)=>b.time==='10:00');
 assert.equal(mine.studentName,'Sam');
 assert.equal((await call('link',{id:mine.id,link:'http://insecure.test'})).status,400);
 assert.equal((await call('link',{id:mine.id,link:'https://meet.test/x'})).status,200);
 assert.equal((await call('complete',{id:mine.id})).status,200);
 await login('Tom','Student');
 assert.equal((await call('rate',{id:mine.id,rating:5})).status,400,'only the booking owner can rate');
 assert.equal((await call('cancel',{id:mine.id})).status,400);
 await login('Sam','Student');
 v=await view();
 assert.equal(v.data.bookings.find((b:any)=>b.id===mine.id).status,'Completed');
 assert.equal((await call('rate',{id:mine.id,rating:5,comment:'great'})).status,200);
 assert.equal((await call('complete',{id:mine.id})).status,403,'students cannot complete');

 // review with attachment: mentor opens it, outsiders cannot
 const file=await put('draft.pdf','application/pdf','%PDF student draft');
 const sub=await call('review',{track:'IELTS',title:'Essay',text:'hello world',mentorId,file});
 assert.equal(sub.status,200);
 const review=sub.json.data.reviews[0];
 await login('Maya','Mentor');
 v=await view();
 assert.equal(v.data.reviews[0].studentName,'Sam');
 assert.equal(await (await open(file.id)).text(),'%PDF student draft');
 assert.equal((await call('note',{id:review.id,category:'TR',text:'be specific',quote:'hello'})).status,200);
 const voice=await put('v.webm','audio/webm','voice');
 assert.equal((await call('audio',{id:review.id,file:voice})).status,200);
 assert.equal((await call('feedback',{id:review.id,feedback:'nice',score:'6.5'})).status,200);
 await login('Tom','Student');
 assert.equal((await open(file.id)).status,404,'other students cannot open it');
 await login('Sam','Student');
 v=await view();
 assert.equal(v.data.reviews[0].status,'Feedback ready');
 assert.equal(await (await open(voice.id)).text(),'voice');
 assert.ok(v.data.notifications.some((n:any)=>n.text.startsWith('Feedback ready')));

 // complaints reach the admin; reviews reach them without the learner's work
 assert.equal((await call('complaint',{text:'help'})).status,200);
 await login('Ada','Admin');
 v=await view();
 assert.equal(v.data.complaints[0].from,'Sam');
 assert.equal(v.data.reviews[0].text,'');
 assert.equal((await call('resolve',{id:v.data.complaints[0].id})).status,200);
 await login('Sam','Student');
 assert.equal((await view()).data.complaints[0].status,'Resolved');

 // availability belongs to the mentor
 await login('Maya','Mentor');
 assert.equal((await call('availability',{times:['14:00']})).status,200);
 assert.deepEqual((await view()).data.availability,['14:00']);
 assert.equal((await call('book',{mentorId,date:day,time:'10:00',topic:'t'})).status,403,'mentors cannot book');
});
