-- Las tablas respaldo_* son copias hechas a mano antes de retocar datos. Se crearon
-- en public sin RLS, así que la API las servía a cualquiera con la anon key.
-- RLS sin políticas: solo el service role y el SQL editor pueden leerlas.
do $$
declare t text;
begin
  for t in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'respaldo\_%'
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- La función ya usa nombres cualificados; fijar el search_path la protege de
-- que alguien sombree public.invitaciones con otro esquema.
alter function public.canjear_invitacion(text, text) set search_path = '';
