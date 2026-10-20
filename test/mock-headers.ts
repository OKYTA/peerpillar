export const jar=new Map<string,string>();
// Snapshot at call time so concurrent requests keep the identity they started with.
export async function cookies(){const snap=new Map(jar);return {get:(k:string)=>snap.has(k)?{value:snap.get(k)!}:undefined,set:(k:string,v:string)=>void jar.set(k,v),delete:(k:string)=>void jar.delete(k)}}
