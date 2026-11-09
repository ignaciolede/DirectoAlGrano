/* Directo al grano — conexión a Supabase.
   Copiá los dos valores de Dashboard → Project Settings → API (o "Connect").
   La anon key es pública por diseño: lo que protege los datos es Row Level Security (supabase/schema.sql).
   Nunca pongas acá la service_role key. */
window.DAG_CONFIG = {
  supabaseUrl: 'https://lazqsbgzoomyzqacnica.supabase.co',
  supabaseAnonKey: 'sb_publishable_neIPeePcjbtrCl3709nI7A_7hlOWDTY'
};
