import { handlers } from '../../server/runtime.ts';
export const GET = (req: Request) => handlers.stats(req);
