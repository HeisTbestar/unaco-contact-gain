// Local development only: in-memory store, data is lost on restart.
import { createServer } from 'node:http';
import { createHandlers } from './handlers.ts';
import { memoryStore } from './store.ts';
const h = createHandlers({ store: memoryStore(), env: { ADMIN_EXPORT_TOKEN: process.env.ADMIN_EXPORT_TOKEN } });
type H = (r: Request) => Promise<Response>;
const routes: Record<string, Record<string, H>> = {
  '/api/register': { POST: h.register }, '/api/withdraw': { POST: h.withdraw }, '/api/track': { POST: h.track },
  '/api/admin/export': { GET: h.exportVcf }, '/api/admin/stats': { GET: h.stats },
  '/api/admin/session': { POST: h.session, DELETE: h.session },
  '/api/admin/registrations': { GET: h.registrations, PATCH: h.registrations, DELETE: h.registrations },
};
createServer(async (rq, rs) => {
  const route = routes[(rq.url ?? '').split('?')[0]], fn = route?.[rq.method ?? ''];
  if (!route || !fn) { rs.writeHead(route ? 405 : 404).end(); return; }
  const chunks: Buffer[] = []; for await (const c of rq) chunks.push(c as Buffer);
  const req = new Request('http://localhost' + rq.url, { method: rq.method, headers: rq.headers as Record<string, string>, body: rq.method === 'GET' || rq.method === 'DELETE' ? undefined : Buffer.concat(chunks) });
  const res = await fn(req);
  rs.writeHead(res.status, Object.fromEntries(res.headers)); rs.end(Buffer.from(await res.arrayBuffer()));
}).listen(8787, () => console.log('dev api on :8787'));
