-- Tanda 10: reconstrucción de la cartera a partir de los movimientos ya importados.
--
-- Los movimientos de inversión que ya estaban en la base de datos se importaron antes de
-- que existiera el libro de operaciones (migración 0022), así que llegaron como simples
-- gastos: la app sabía que habían salido 50 € pero no qué se había comprado con ellos.
--
-- Por suerte no hace falta reimportar nada: la descripción que guardó Trade Republic
-- conserva el ISIN y la cantidad —
--   "Savings plan execution IE0032126645 Vanguard ... , quantity: 0.625359"
-- — así que la operación se puede reconstruir entera desde el texto.
--
-- Una diferencia con lo que importe la app a partir de ahora: el precio unitario aquí se
-- deduce dividiendo el importe entre las participaciones, así que incluye la comisión
-- que llevara la operación (en un plan de ahorro de Trade Republic, ninguna; en una
-- compra suelta, 1 €). Las valoraciones derivadas de esos precios quedan marcadas como
-- 'automatico' y cualquier valoración manual las pisa.
--
-- Idempotente: solo toca movimientos que todavía no tienen operación asociada, y no
-- sobrescribe ninguna valoración existente. En el proyecto de desarrollo, donde no hay
-- extractos de Trade Republic, no hace nada.

do $$
declare
  v_creadas integer;
  v_operaciones integer;
begin
  -- Movimientos cuya descripción tiene la forma de una operación de Trade Republic y que
  -- todavía no han generado ninguna operación. No se filtra por categoría a propósito:
  -- si la descripción dice que es una compra de un ISIN concreto, lo es, esté bien
  -- categorizado el movimiento o no.
  create temporary table tmp_ops_backfill on commit drop as
  select
    m.id as movimiento_id,
    m.usuario_id,
    m.fecha,
    m.importe,
    partes[1] as accion,
    partes[2] as isin,
    btrim(partes[3]) as nombre_activo,
    partes[4]::numeric as cantidad
  from public.movimientos m
  cross join lateral (
    select regexp_match(
      m.descripcion,
      '^\s*(Savings plan execution|Buy trade|Sell trade)\s+([A-Z]{2}[A-Z0-9]{9}[0-9])\s+(.*),\s*quantity:\s*([0-9.]+)\s*$'
    ) as partes
  ) p
  where p.partes is not null
    and not exists (
      select 1 from public.inversion_operaciones o where o.movimiento_id = m.id
    );

  -- 1. Las posiciones que falten. El tipo de activo se deduce de cómo se ha operado:
  -- lo que se compra con un plan de ahorro es un fondo/ETF; lo que solo se ha comprado
  -- suelto se marca como acciones. Es una suposición razonable y editable a mano.
  insert into public.inversiones
    (usuario_id, tipo_activo, nombre, valor_actual, moneda, origen, isin)
  select distinct on (t.usuario_id, t.isin)
    t.usuario_id,
    case when bool_or(t.accion = 'Savings plan execution') over (partition by t.usuario_id, t.isin)
      then 'Fondo indexado' else 'Acciones' end,
    t.nombre_activo,
    0,
    'EUR',
    'manual',
    t.isin
  from tmp_ops_backfill t
  where not exists (
    select 1 from public.inversiones i where i.usuario_id = t.usuario_id and i.isin = t.isin
  )
  order by t.usuario_id, t.isin, t.fecha desc;

  get diagnostics v_creadas = row_count;

  -- 2. Las operaciones. Signo: una compra es dinero que ENTRA en la inversión (importe
  -- positivo) aunque en el extracto sea un cargo (importe negativo); una venta, al revés.
  insert into public.inversion_operaciones
    (usuario_id, inversion_id, fecha, tipo, importe, participaciones, precio, movimiento_id, origen)
  select
    t.usuario_id,
    i.id,
    t.fecha,
    case when t.accion = 'Sell trade' then 'venta' else 'compra' end,
    -t.importe,
    case when t.accion = 'Sell trade' then -t.cantidad else t.cantidad end,
    case when t.cantidad > 0 then round(abs(t.importe) / t.cantidad, 6) else null end,
    t.movimiento_id,
    'importado'
  from tmp_ops_backfill t
  join public.inversiones i on i.usuario_id = t.usuario_id and i.isin = t.isin;

  get diagnostics v_operaciones = row_count;

  -- 3. Las valoraciones que se deducen de esos precios. El precio de una operación vale
  -- para todas las participaciones que hubiera ese día, no solo para las compradas, así
  -- que cada operación deja un punto real de valor de la posición entera. `range` en vez
  -- de `rows` en la ventana es deliberado: hace que varias operaciones del mismo día
  -- cuenten todas dentro del acumulado de ese día.
  insert into public.inversion_valoraciones (usuario_id, inversion_id, fecha, valor, origen)
  select distinct on (v.inversion_id, v.fecha)
    v.usuario_id, v.inversion_id, v.fecha,
    -- Participaciones netas a cero = posición cerrada, valor cero. Ver el mismo caso en
    -- revalorizar_inversion (migración 0022).
    case when v.acumuladas > 0 then round(v.acumuladas * v.precio, 2) else 0 end,
    'automatico'
  from (
    select
      o.usuario_id,
      o.inversion_id,
      o.fecha,
      o.id,
      o.precio,
      sum(o.participaciones) over (
        partition by o.inversion_id order by o.fecha
        range between unbounded preceding and current row
      ) as acumuladas
    from public.inversion_operaciones o
    where o.precio is not null
  ) v
  order by v.inversion_id, v.fecha, v.id desc
  on conflict (inversion_id, fecha) do nothing;

  -- 4. Los campos cacheados de cada posición, reconstruidos desde su libro. No se usa
  -- recalcular_inversion() porque esa función corre con auth.uid(), que en una migración
  -- es null; aquí se hace el mismo cálculo pero para todas las inversiones a la vez.
  update public.inversiones i
  set
    participaciones = coalesce(
      (select sum(o.participaciones) from public.inversion_operaciones o where o.inversion_id = i.id), 0),
    coste_neto = coalesce(
      (select sum(o.importe) from public.inversion_operaciones o where o.inversion_id = i.id), 0),
    valor_actual = coalesce(
      (select v.valor from public.inversion_valoraciones v
        where v.inversion_id = i.id order by v.fecha desc limit 1), i.valor_actual),
    fecha_actualizacion = coalesce(
      (select v.fecha::timestamptz from public.inversion_valoraciones v
        where v.inversion_id = i.id order by v.fecha desc limit 1), i.fecha_actualizacion);

  raise notice 'Backfill de inversiones: % posiciones creadas, % operaciones reconstruidas', v_creadas, v_operaciones;
end;
$$;
