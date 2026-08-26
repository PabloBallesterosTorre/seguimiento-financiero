-- Bug (tanda 6, mejora 1): movimientos_previstos.movimiento_real_id solo podía recordar
-- la conciliación de un mes a la vez (una columna, un valor), así que conciliar un mes
-- nuevo pisaba el vínculo del mes anterior. Se sustituye por una fila por instancia
-- mensual conciliada, para que cada mes se pueda vincular/desvincular de forma
-- independiente y quede histórico completo de qué meses están conciliados.
create table if not exists public.previsto_conciliaciones (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  previsto_id uuid not null references public.movimientos_previstos(id) on delete cascade,
  periodo date not null,
  movimiento_real_id uuid not null references public.movimientos(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (previsto_id, periodo)
);

alter table public.previsto_conciliaciones enable row level security;

create policy "previsto_conciliaciones: select propios" on public.previsto_conciliaciones
  for select using (auth.uid() = usuario_id);
create policy "previsto_conciliaciones: insert propios" on public.previsto_conciliaciones
  for insert with check (auth.uid() = usuario_id);
create policy "previsto_conciliaciones: update propios" on public.previsto_conciliaciones
  for update using (auth.uid() = usuario_id);
create policy "previsto_conciliaciones: delete propios" on public.previsto_conciliaciones
  for delete using (auth.uid() = usuario_id);

-- Backfill: cada previsto que ya tenía un movimiento_real_id conservaba solo el último
-- mes vinculado; su periodo es el mes de la fecha de ese movimiento real.
insert into public.previsto_conciliaciones (usuario_id, previsto_id, periodo, movimiento_real_id)
select mp.usuario_id, mp.id, date_trunc('month', m.fecha)::date, mp.movimiento_real_id
from public.movimientos_previstos mp
join public.movimientos m on m.id = mp.movimiento_real_id
where mp.movimiento_real_id is not null
on conflict (previsto_id, periodo) do nothing;

alter table public.movimientos_previstos drop column movimiento_real_id;
