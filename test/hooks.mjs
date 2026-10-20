// Test-only resolver: swaps the Vercel Blob / Next cookie modules for in-memory mocks and resolves extensionless .ts imports.
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const mocks={'@vercel/blob':new URL('./mock-blob.ts',import.meta.url).href,'next/headers':new URL('./mock-headers.ts',import.meta.url).href};
export async function resolve(spec,ctx,next){
 if(mocks[spec])return {url:mocks[spec],shortCircuit:true};
 if(spec.startsWith('.')&&!/\.\w+$/.test(spec)){for(const ext of ['.ts','/index.ts']){const u=new URL(spec+ext,ctx.parentURL);if(existsSync(fileURLToPath(u)))return {url:u.href,shortCircuit:true}}}
 return next(spec,ctx);
}
