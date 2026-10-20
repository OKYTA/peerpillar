import {get,put,BlobPreconditionFailedError,BlobNotFoundError} from '@vercel/blob';
export async function readJson<T>(path:string):Promise<{value:T;etag:string}|null>{
 try{const res=await get(path,{access:'private',useCache:false});if(!res||res.statusCode!==200)return null;return {value:JSON.parse(await new Response(res.stream).text()) as T,etag:res.blob.etag};}catch(e){if(e instanceof BlobNotFoundError)return null;throw e}
}
export async function writeJson(path:string,value:unknown,etag?:string){
 try{await put(path,JSON.stringify(value),{access:'private',contentType:'application/json',addRandomSuffix:false,allowOverwrite:!!etag,...(etag?{ifMatch:etag}:{})});return true;}catch(e){if(e instanceof BlobPreconditionFailedError||e instanceof Error&&e.name==='BlobAlreadyExistsError')return false;throw e}
}
export const sharedPath='shared.json';
export const workspacePath=(id:string)=>`workspaces/${id}.json`;
export const fileMetaPath=(user:string,id:string)=>`metadata/${user}/${id}.json`;
export const filePath=(user:string,id:string)=>`files/${user}/${id}`;
export {get,put};
