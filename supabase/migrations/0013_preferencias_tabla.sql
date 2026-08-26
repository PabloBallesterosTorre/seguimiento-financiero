-- Orden de columna elegido por el usuario para cada tabla de la app, persistido
-- para que se recuerde entre sesiones (tanda 5, mejora 2). Una fila por tabla y
-- usuario: el criterio de ordenación es independiente entre tablas.
create table if not exists public.preferencias_tabla (
  usuario_id uuid not null references auth.users(id) on delete cascade,
  tabla text not null,
  columna text not null,
  direccion text not null check (direccion in ('asc', 'desc')),
  updated_at timestamptz not null default now(),
  primary key (usuario_id, tabla)
);

alter table public.preferencias_tabla enable row level security;

create policy "preferencias_tabla: select propias" on public.preferencias_tabla
  for select using (auth.uid() = usuario_id);
create policy "preferencias_tabla: insert propias" on public.preferencias_tabla
  for insert with check (auth.uid() = usuario_id);
create policy "preferencias_tabla: update propias" on public.preferencias_tabla
  for update using (auth.uid() = usuario_id);
create policy "preferencias_tabla: delete propias" on public.preferencias_tabla
  for delete using (auth.uid() = usuario_id);
