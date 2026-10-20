import { handlers } from '../../server/runtime.ts';
export const POST = (req: Request) => handlers.session(req);
export const DELETE = (req: Request) => handlers.session(req);
