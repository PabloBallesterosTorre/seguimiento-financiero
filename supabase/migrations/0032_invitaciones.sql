-- Registro por invitación.
--
-- Hasta ahora el alta estaba cerrada del todo: el usuario se creaba a mano en el panel de
-- Supabase. Esta tabla abre la puerta sin abrirla a cualquiera — para darse de alta hace
-- falta un código que solo existe si alguien lo ha creado antes.
--
-- La invitación va atada a un email concreto a propósito. Un código suelto se lo puede
-- gastar quien reciba el enlace reenviado; atado al email, el reenvío no sirve de nada y
-- además el email queda verificado de facto, porque lo escribe quien invita, no quien
-- se registra.
--
-- El canje NO pasa por aquí con la anon key: lo hace el servidor con la service-role key
-- (ver lib/supabase/admin.ts), porque el alta pública de Supabase Auth sigue desactivada.
-- Estas políticas RLS solo gobiernan quién ve y gestiona sus propias invitaciones.
create table if not exists public.invitaciones (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  -- El único email que puede canjearla. Se guarda siempre en minúsculas (lo normaliza
  -- la aplicación) para que la comparación al canjear no dependa de cómo se teclee.
  email text not null,
  -- Para acordarse de a quién era: "Juan, el del grupo de escalada".
  nota text,
  creada_por uuid not null references auth.users(id) on delete cascade,
  creada_en timestamptz not null default now(),
  caduca_en timestamptz not null default (now() + interval '30 days'),
  -- Reserva temporal durante el canje. El alta son dos pasos que no comparten
  -- transacción (marcar la invitación aquí y crear el usuario en auth.users), así que
  -- entre uno y otro hace falta algo que impida que dos peticiones simultáneas gasten
  -- el mismo código. Si el proceso se cae por el medio, la reserva caduca sola a los
  -- 10 minutos (ver el `where` del canje) y el código vuelve a estar disponible: sin
  -- eso, un fallo puntual dejaría la invitación inservible para siempre.
  reservada_en timestamptz,
  usada_por uuid references auth.users(id) on delete set null,
  usada_en timestamptz
);

create index if not exists invitaciones_creada_por_idx on public.invitaciones (creada_por);
create index if not exists invitaciones_email_idx on public.invitaciones (lower(email));

alter table public.invitaciones enable row level security;

-- `create policy` no admite `if not exists` y falla al reaplicarse — y en este repo las
-- migraciones se han reaplicado más de una vez (ver el aviso del README sobre 0022).
-- Con el drop previo, esta migración es segura de volver a lanzar.
drop policy if exists "invitaciones: select propias" on public.invitaciones;
drop policy if exists "invitaciones: insert propias" on public.invitaciones;
drop policy if exists "invitaciones: update propias" on public.invitaciones;
drop policy if exists "invitaciones: delete propias" on public.invitaciones;

create policy "invitaciones: select propias" on public.invitaciones
  for select using (auth.uid() = creada_por);
create policy "invitaciones: insert propias" on public.invitaciones
  for insert with check (auth.uid() = creada_por);
create policy "invitaciones: update propias" on public.invitaciones
  for update using (auth.uid() = creada_por);
create policy "invitaciones: delete propias" on public.invitaciones
  for delete using (auth.uid() = creada_por);

comment on table public.invitaciones is
  'Códigos de un solo uso para darse de alta. El canje lo ejecuta el servidor con la service-role key; estas políticas solo cubren la gestión desde la pantalla de Configuración.';

-- ============ CANJE ============
-- El canje es un `update` condicional que tiene que ser atómico: entre comprobar que la
-- invitación está libre y marcarla cabe otra petición, y dos personas acabarían con el
-- mismo código. Vive aquí y no en la aplicación por dos razones:
--
--  1. Expresado como filtros de PostgREST, el "o la reserva ha caducado" depende de una
--     sintaxis de consulta que no se puede probar sin desplegar. En SQL es una sentencia
--     normal, comprobable contra la base de datos.
--  2. Todas las condiciones (existe, es para este email, no usada, no caducada, sin
--     reserva viva) viajan en el mismo `where`, así que Postgres las evalúa bajo el
--     cerrojo de fila del propio update. Quien gane se lleva la fila; al resto no les
--     devuelve nada.
--
-- Devuelve el id de la invitación reservada, o null si no se pudo canjear. Deliberadamente
-- NO dice por qué falla: el motivo se calcula aparte, leyendo la invitación, para poder dar
-- un mensaje útil ("ya se usó", "es para otro email"). Esta función solo reparte el turno.
create or replace function public.canjear_invitacion(p_codigo text, p_email text)
returns uuid
language sql
volatile
as $$
  update public.invitaciones
  set reservada_en = now()
  where codigo = p_codigo
    and lower(email) = lower(p_email)
    and usada_en is null
    and caduca_en > now()
    and (reservada_en is null or reservada_en < now() - interval '10 minutes')
  returning id;
$$;

-- Sin SECURITY DEFINER: la llama el servidor con la service-role key, que ya salta RLS.
-- Y sin permiso para nadie más — un visitante anónimo no tiene por qué poder tocar
-- invitaciones ni aunque no consiga canjear ninguna.
revoke all on function public.canjear_invitacion(text, text) from public;
revoke all on function public.canjear_invitacion(text, text) from anon, authenticated;
grant execute on function public.canjear_invitacion(text, text) to service_role;
