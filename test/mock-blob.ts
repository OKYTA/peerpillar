const store=new Map<string,{body:string|Uint8Array;etag:number}>();
export class BlobNotFoundError extends Error{}
export class BlobPreconditionFailedError extends Error{}
export async function get(path:string,_opts?:unknown){const e=store.get(path);if(!e)return null;return {statusCode:200,stream:new Blob([e.body as BlobPart]).stream(),blob:{etag:String(e.etag)}}}
export async function put(path:string,body:string|Blob,o:{allowOverwrite?:boolean;ifMatch?:string}={}){
 const e=store.get(path);
 if(e&&!o.allowOverwrite){const x=new Error('exists');x.name='BlobAlreadyExistsError';throw x}
 if(e&&o.ifMatch&&o.ifMatch!==String(e.etag))throw new BlobPreconditionFailedError();
 store.set(path,{body:typeof body==='string'?body:new Uint8Array(await body.arrayBuffer()),etag:(e?.etag??0)+1});return {pathname:path};
}
