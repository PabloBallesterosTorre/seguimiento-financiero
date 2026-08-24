-- Previsión de flujo de caja: movimientos futuros (fijos o variables, puntuales o
-- recurrentes) que alimentan la proyección desglosada por categoría. Puede
-- enlazar con un movimiento real cuando se concilia (movimiento_real_id).
create table if not exists public.movimientos_previstos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  cuenta_id uuid references public.cuentas(id) on delete set null,
  descripcion text not null,
  categoria_id uuid references public.categorias(id) on delete set null,
  subcategoria_id uuid references public.categorias(id) on delete set null,
  tipo text not null check (tipo in ('ingreso', 'gasto', 'traspaso')),
  importe_estimado numeric(14, 2) not null,
  importe_min numeric(14, 2),
  importe_max numeric(14, 2),
  tipo_recurrencia text not null check (tipo_recurrencia in ('unica_vez', 'recurrente')),
  periodicidad text check (periodicidad in ('mensual', 'anual')),
  fecha date,
  fecha_inicio date,
  fecha_fin date,
  estado text not null default 'activo' check (estado in ('activo', 'pausado')),
  movimiento_real_id uuid references public.movimientos(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.movimientos_previstos enable row level security;

create policy "movimientos_previstos: select propios" on public.movimientos_previstos
  for select using (auth.uid() = usuario_id);
create policy "movimientos_previstos: insert propios" on public.movimientos_previstos
  for insert with check (auth.uid() = usuario_id);
create policy "movimientos_previstos: update propios" on public.movimientos_previstos
  for update using (auth.uid() = usuario_id);
create policy "movimientos_previstos: delete propios" on public.movimientos_previstos
  for delete using (auth.uid() = usuario_id);
