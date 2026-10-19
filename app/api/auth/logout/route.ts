import {cookies} from 'next/headers';
import {SESSION_COOKIE} from '../../../../lib/session';
export async function POST(req:Request){if(req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'Invalid origin'},{status:403});(await cookies()).delete(SESSION_COOKIE);return Response.redirect(new URL('/',req.url),303)}
