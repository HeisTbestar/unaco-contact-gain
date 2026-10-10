// Local development only: in-memory store, data is lost on restart.
import { createServer } from 'node:http';
import { createHandlers } from './handlers.ts';
import { memoryStore } from './store.ts';
const h = createHandlers({ store: memoryStore(), env: { ADMIN_EXPORT_TOKEN: process.env.ADMIN_EXPORT_TOKEN } });
const routes: Record<string, [string, (r: Request) => Promise<Response>]> = {
  '/api/register': ['POST', h.register], '/api/withdraw': ['POST', h.withdraw], '/api/admin/export': ['GET', h.exportVcf] };
createServer(async (rq, rs) => {
  const route = routes[(rq.url ?? '').split('?')[0]];
  if (!route || rq.method !== route[0]) { rs.writeHead(route ? 405 : 404).end(); return; }
  const chunks: Buffer[] = []; for await (const c of rq) chunks.push(c as Buffer);
  const req = new Request('http://localhost' + rq.url, { method: rq.method, headers: rq.headers as Record<string, string>, body: rq.method === 'GET' ? undefined : Buffer.concat(chunks) });
  const res = await route[1](req);
  rs.writeHead(res.status, Object.fromEntries(res.headers)); rs.end(Buffer.from(await res.arrayBuffer()));
}).listen(8787, () => console.log('dev api on :8787'));
