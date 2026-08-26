-- Descartar una sugerencia de previsión (nivel 1 o nivel 2) debe recordarse: si no,
-- el motor de detección la volvería a proponer en el siguiente análisis del
-- histórico y la acción de descartar no serviría de nada. `clave` reutiliza la misma
-- clave que ya calculan detectarPatronesPorDescripcion (nivel 1, "tipo:descripcion
-- normalizada") y detectarMediaPorCategoria (nivel 2, "tipo:categoria_id") — `nivel`
-- evita cualquier colisión improbable entre los dos espacios de claves.
create table if not exists public.patrones_descartados (
  usuario_id uuid not null references auth.users(id) on delete cascade,
  nivel text not null check (nivel in ('descripcion', 'categoria')),
  clave text not null,
  created_at timestamptz not null default now(),
  primary key (usuario_id, nivel, clave)
);

alter table public.patrones_descartados enable row level security;

create policy "patrones_descartados: select propios" on public.patrones_descartados
  for select using (auth.uid() = usuario_id);
create policy "patrones_descartados: insert propios" on public.patrones_descartados
  for insert with check (auth.uid() = usuario_id);
create policy "patrones_descartados: delete propios" on public.patrones_descartados
  for delete using (auth.uid() = usuario_id);
