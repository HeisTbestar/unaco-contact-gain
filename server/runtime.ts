import { createHandlers } from './handlers.ts';
import { supabaseStore } from './store.ts';
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EXPORT_TOKEN } = process.env;
export const handlers = createHandlers({
  store: SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY ? supabaseStore(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) : null,
  env: { ADMIN_EXPORT_TOKEN },
});
