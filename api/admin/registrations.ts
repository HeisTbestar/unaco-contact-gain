import { handlers } from '../../server/runtime.ts';
export const GET = (req: Request) => handlers.registrations(req);
export const PATCH = (req: Request) => handlers.registrations(req);
export const DELETE = (req: Request) => handlers.registrations(req);
