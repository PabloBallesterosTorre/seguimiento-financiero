-- Tanda 18: inmuebles.
--
-- Un inmueble es un activo más del patrimonio, como una inversión, pero con tres cosas
-- propias: se valora a mano de tarde en tarde (no hay cotización), puede ser tuyo solo en
-- parte (copropiedad) y suele tener una hipoteca y unos movimientos —alquiler, comunidad,
-- IBI— que dicen si te da dinero o te lo cuesta.
--
-- Decisiones:
--   * El valor se guarda al 100 % y aparte el porcentaje que es tuyo. El patrimonio suma
--     valor × porcentaje; así cambiar la copropiedad no obliga a revalorar.
--   * La hipoteca NO se duplica: el inmueble apunta a su fila de `deudas`, que ya resta del
--     patrimonio y ya tiene cuadro de amortización y categoría de pago.
--   * Los movimientos se vinculan con su propio campo `movimientos.inmueble_id` (no con
--     etiquetas: el usuario lo prefirió así). Las cuotas de la hipoteca enlazada cuentan
--     solas, por su categoría de pago, sin marcarlas una a una.
--   * Solo suma en el patrimonio "con deuda": la portada abre sin deuda y ahí sigue
--     enseñando líquido + inversión. Un piso sin restar su hipoteca inflaría ese número.

create table if not exists public.inmuebles (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  nombre text not null check (length(trim(nombre)) > 0),
  uso text not null default 'alquiler'
    check (uso in ('alquiler', 'vivienda_habitual', 'segunda_residencia', 'otro')),
  direccion text,
  superficie_m2 numeric(8, 2) check (superficie_m2 is null or superficie_m2 > 0),
  fecha_compra date,
  precio_compra numeric(14, 2) check (precio_compra is null or precio_compra >= 0),
  -- Notaría, registro, impuestos y reformas iniciales: la revalorización se mide contra
  -- lo que de verdad costó, no solo contra el precio de la escritura.
  gastos_compra numeric(14, 2) not null default 0 check (gastos_compra >= 0),
  porcentaje_propiedad numeric(5, 2) not null default 100
    check (porcentaje_propiedad > 0 and porcentaje_propiedad <= 100),
  valor_actual numeric(14, 2) check (valor_actual is null or valor_actual >= 0),
  fecha_valoracion date,
  deuda_id uuid references public.deudas(id) on delete set null,
  -- Fianza cobrada al inquilino: hay que devolverla, así que se enseña aparte y no suma.
  fianza numeric(14, 2) check (fianza is null or fianza >= 0),
  ambito text not null default 'personal' check (ambito in ('personal', 'conjunto')),
  notas text,
  created_at timestamptz not null default now()
);

alter table public.inmuebles enable row level security;

create policy "inmuebles: select propios" on public.inmuebles
  for select using (auth.uid() = usuario_id);
-- La hipoteca enlazada tiene que ser del mismo usuario.
create policy "inmuebles: insert propios" on public.inmuebles
  for insert with check (
    auth.uid() = usuario_id
    and (deuda_id is null or exists (select 1 from public.deudas d where d.id = deuda_id and d.usuario_id = auth.uid()))
  );
create policy "inmuebles: update propios" on public.inmuebles
  for update using (auth.uid() = usuario_id)
  with check (
    auth.uid() = usuario_id
    and (deuda_id is null or exists (select 1 from public.deudas d where d.id = deuda_id and d.usuario_id = auth.uid()))
  );
create policy "inmuebles: delete propios" on public.inmuebles
  for delete using (auth.uid() = usuario_id);

-- Historial de valoraciones, para ver la evolución. `inmuebles.valor_actual` es la última.
create table if not exists public.inmueble_valoraciones (
  id uuid primary key default gen_random_uuid(),
  inmueble_id uuid not null references public.inmuebles(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  fecha date not null,
  valor numeric(14, 2) not null check (valor >= 0),
  created_at timestamptz not null default now(),
  unique (inmueble_id, fecha)
);

alter table public.inmueble_valoraciones enable row level security;

create policy "inmueble_valoraciones: select propias" on public.inmueble_valoraciones
  for select using (auth.uid() = usuario_id);
create policy "inmueble_valoraciones: insert propias" on public.inmueble_valoraciones
  for insert with check (
    auth.uid() = usuario_id
    and exists (select 1 from public.inmuebles i where i.id = inmueble_id and i.usuario_id = auth.uid())
  );
create policy "inmueble_valoraciones: update propias" on public.inmueble_valoraciones
  for update using (auth.uid() = usuario_id);
create policy "inmueble_valoraciones: delete propias" on public.inmueble_valoraciones
  for delete using (auth.uid() = usuario_id);

create index if not exists inmueble_valoraciones_inmueble_idx on public.inmueble_valoraciones (inmueble_id, fecha);

-- El vínculo de cada movimiento. Al borrar el inmueble los movimientos se quedan, sueltos.
alter table public.movimientos
  add column if not exists inmueble_id uuid references public.inmuebles(id) on delete set null;

create index if not exists movimientos_inmueble_idx on public.movimientos (inmueble_id) where inmueble_id is not null;

comment on column public.movimientos.inmueble_id is
  'Inmueble al que pertenece el movimiento (alquiler, comunidad, IBI, reformas...). Las cuotas de su hipoteca se cuentan aparte, por la categoría de pago de la deuda.';

-- El MCP (migración 0038) también ve los inmuebles en el patrimonio neto.
create or replace function public.mcp_patrimonio(p_clave text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  u uuid := public.mcp_usuario(p_clave);
  v_cuentas numeric := (select coalesce(sum(saldo_actual), 0) from public.cuentas where usuario_id = u and activa);
  v_inversion numeric := (select coalesce(sum(valor_actual), 0) from public.inversiones where usuario_id = u);
  v_inmuebles numeric := (select coalesce(sum(coalesce(valor_actual, 0) * porcentaje_propiedad / 100), 0)
    from public.inmuebles where usuario_id = u);
  v_deuda numeric := (select coalesce(sum(capital_pendiente), 0) from public.deudas where usuario_id = u);
begin
  return jsonb_build_object(
    'cuentas', v_cuentas, 'inversion', v_inversion, 'inmuebles', round(v_inmuebles, 2), 'deuda', v_deuda,
    'patrimonio_neto', round(v_cuentas + v_inversion + v_inmuebles - v_deuda, 2),
    'patrimonio_sin_deuda_ni_inmuebles', v_cuentas + v_inversion,
    'inversiones', coalesce((
      select jsonb_agg(jsonb_build_object(
        'nombre', i.nombre, 'tipo', i.tipo_activo, 'valor', i.valor_actual,
        'aportado_neto', i.coste_neto, 'ganancia', i.valor_actual - i.coste_neto,
        'participaciones', i.participaciones, 'actualizado', i.fecha_actualizacion::date)
        order by i.valor_actual desc)
      from public.inversiones i where i.usuario_id = u), '[]'::jsonb),
    'inmuebles_detalle', coalesce((
      select jsonb_agg(jsonb_build_object(
        'nombre', im.nombre, 'uso', im.uso, 'valor_total', im.valor_actual,
        'porcentaje_propiedad', im.porcentaje_propiedad,
        'valor_tu_parte', round(coalesce(im.valor_actual, 0) * im.porcentaje_propiedad / 100, 2),
        'valorado', im.fecha_valoracion, 'precio_compra', im.precio_compra,
        'hipoteca', d.nombre, 'hipoteca_pendiente', d.capital_pendiente)
        order by im.nombre)
      from public.inmuebles im left join public.deudas d on d.id = im.deuda_id
      where im.usuario_id = u), '[]'::jsonb),
    'deudas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'nombre', d.nombre, 'tipo', d.tipo, 'pendiente', d.capital_pendiente, 'cuota', d.cuota,
        'periodicidad', d.periodicidad, 'interes', d.tipo_interes, 'fin', d.fecha_fin)
        order by d.capital_pendiente desc)
      from public.deudas d where d.usuario_id = u), '[]'::jsonb)
  );
end;
$$;
