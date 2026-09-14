// Public runtime config, injected by EAS build env (see eas.json) or a local
// .env. None of these are secrets — the anon key + public URLs are safe to ship
// in the app. Privileged operations go through the admin API, which holds the
// real secrets server-side.
export const ADMIN_API_BASE_URL = process.env.EXPO_PUBLIC_ADMIN_API_BASE_URL ?? '';
export const R2_PUBLIC_BASE_URL = process.env.EXPO_PUBLIC_R2_PUBLIC_BASE_URL ?? '';
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
