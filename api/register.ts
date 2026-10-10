import { handlers } from '../server/runtime.ts';
export const POST = (req: Request) => handlers.register(req);
