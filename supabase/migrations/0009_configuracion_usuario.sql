-- Configuración de perfil: una fila por usuario. Sustituye a la gestión de
-- objetivos_ahorro por periodo por un único valor global (más simple, sin
-- excepciones mes a mes). No se borra objetivos_ahorro para no perder histórico,
-- pero la app deja de leerla/escribirla a partir de ahora.
create table if not exists public.configuracion_usuario (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  nombre text,
  moneda_base text not null default 'EUR',
  idioma text not null default 'es',
  objetivo_ahorro_mensual numeric(14, 2),
  incluir_inversion_en_ahorro boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.configuracion_usuario enable row level security;

create policy "configuracion_usuario: select propia" on public.configuracion_usuario
  for select using (auth.uid() = usuario_id);
create policy "configuracion_usuario: insert propia" on public.configuracion_usuario
  for insert with check (auth.uid() = usuario_id);
create policy "configuracion_usuario: update propia" on public.configuracion_usuario
  for update using (auth.uid() = usuario_id);
