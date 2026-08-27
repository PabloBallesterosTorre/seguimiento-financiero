-- Tanda 8, mejora 2: cierra los tres huecos de Inversiones señalados en el análisis
-- funcional — recurrente vs. puntual, evolución diaria y rentabilidad asumida.

-- a) Recurrente vs. puntual: checkbox en la propia inversión. Si es recurrente, se
-- vincula a un Movimiento previsto de categoría inversión (conciliación mensual con
-- el mecanismo ya existente de previsto_conciliaciones, sin tabla nueva para eso).
alter table public.inversiones
  add column es_recurrente boolean not null default false,
  add column movimiento_previsto_id uuid references public.movimientos_previstos(id) on delete set null;

-- c) Rentabilidad anual asumida: por inversión (encaja mejor que un valor global,
-- porque cada activo tiene un perfil de riesgo/retorno distinto). Se usa tanto para
-- interpolar el histórico (b) como para proyectar el futuro en El Planificador.
alter table public.inversiones
  add column rentabilidad_anual_asumida numeric(6, 3);

-- b) Evolución diaria: cada actualización manual de valor_actual queda registrada
-- como punto real (antes se sobrescribía sin dejar rastro). Entre dos puntos reales,
-- y desde el último hasta hoy, lib/inversiones.ts interpola/extrapola con la
-- rentabilidad asumida — no se guarda ningún dato interpolado, solo los reales.
create table if not exists public.inversion_valoraciones (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  inversion_id uuid not null references public.inversiones(id) on delete cascade,
  fecha date not null,
  valor numeric(14, 2) not null,
  origen text not null default 'manual' check (origen in ('manual', 'automatico')),
  created_at timestamptz not null default now(),
  unique (inversion_id, fecha)
);

create index if not exists inversion_valoraciones_inversion_id_idx on public.inversion_valoraciones (inversion_id);

alter table public.inversion_valoraciones enable row level security;

create policy "inversion_valoraciones: select propias" on public.inversion_valoraciones
  for select using (auth.uid() = usuario_id);
create policy "inversion_valoraciones: insert propias" on public.inversion_valoraciones
  for insert with check (auth.uid() = usuario_id);
create policy "inversion_valoraciones: update propias" on public.inversion_valoraciones
  for update using (auth.uid() = usuario_id);
create policy "inversion_valoraciones: delete propias" on public.inversion_valoraciones
  for delete using (auth.uid() = usuario_id);

-- Backfill: el valor_actual ya guardado en cada inversión existente pasa a ser su
-- primer punto histórico real, para no perder el único dato que había.
insert into public.inversion_valoraciones (usuario_id, inversion_id, fecha, valor, origen)
select usuario_id, id, fecha_actualizacion::date, valor_actual, 'manual'
from public.inversiones
on conflict (inversion_id, fecha) do nothing;
