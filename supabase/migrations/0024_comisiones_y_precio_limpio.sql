-- Tanda 10 (corrección): separar la comisión del precio en las operaciones reconstruidas.
--
-- El backfill de la migración 0023 dedujo el precio unitario dividiendo el importe entre
-- las participaciones. Para un plan de ahorro eso es exacto, porque Trade Republic no
-- cobra comisión. Pero una compra o venta suelta sí lleva 1 € de comisión, y el importe
-- del movimiento ya la trae dentro (así se guarda desde la tanda 9), así que ese euro se
-- coló en el precio:
--
--   * En una COMPRA el precio salía alto → la posición parecía valer más de lo que vale.
--   * En una VENTA el precio salía bajo.
--
-- El efecto no era cosmético. La compra de Ezentis del 17/09/2026 era la última operación
-- de esa posición, así que su precio inflado revalorizaba las 13.224 participaciones
-- enteras: 1.010,00 € en vez de 1.003,73 €. Esos 6,27 € de más eran prácticamente toda la
-- "ganancia" que mostraba la cartera (6,59 €), que en realidad está plana.
--
-- Lo taimado del fallo es que se compensaba solo: la comisión encarece el coste (bien, es
-- dinero que sale) y a la vez inflaba el valor (mal), así que el total parecía razonable.
--
-- Esto solo afecta a lo reconstruido desde la descripción. Lo que se importe a partir de
-- ahora usa la columna `price` del extracto, que ya viene limpia, y guarda la comisión en
-- su propia columna.

do $$
declare
  v_precios integer;
  v_valoraciones integer;
begin
  -- 1. La comisión, a su columna. En Trade Republic es 1 € por operación suelta (`Buy
  -- trade` / `Sell trade`); los planes de ahorro no la llevan. Verificado fila a fila
  -- contra la columna `fee` del extracto: 8 compras y 5 ventas con −1,00 €.
  --
  -- Con una excepción: la venta del 26/06/2026 de 0,278158 participaciones salió sin
  -- comisión en el extracto — es el resto residual que quedaba de la posición después de
  -- vender las 5 participaciones enteras el mismo día, y Trade Republic no cobró por ella.
  update public.inversion_operaciones o
  set comision = case
        when o.fecha = date '2026-06-26' and o.participaciones = -0.278158 then 0
        else 1
      end
  from public.movimientos m
  where m.id = o.movimiento_id
    and o.comision = 0
    and (m.descripcion like 'Buy trade%' or m.descripcion like 'Sell trade%');

  -- 2. El precio, recalculado sobre el importe bruto. Hay que sacar la comisión antes de
  -- dividir, y el signo depende del sentido de la operación: en una compra la comisión
  -- encarece lo que pagaste (hay que restarla), en una venta reduce lo que cobraste (hay
  -- que sumarla) — recordando que `importe` se mira desde la inversión, así que es
  -- positivo cuando el dinero entra en ella.
  update public.inversion_operaciones o
  set precio = round(
        (abs(o.importe) + case when o.importe > 0 then -o.comision else o.comision end)
          / abs(o.participaciones), 6)
  where o.comision <> 0
    and o.participaciones is not null
    and o.participaciones <> 0;

  get diagnostics v_precios = row_count;

  -- 3. Las valoraciones que salieron de esos precios, regeneradas. Solo se borran las
  -- automáticas que caen justo en la fecha de una operación con precio, que son
  -- exactamente las que este bloque vuelve a crear: una valoración manual, o una
  -- automática de otro origen, no se toca.
  delete from public.inversion_valoraciones v
  where v.origen = 'automatico'
    and exists (
      select 1 from public.inversion_operaciones o
      where o.inversion_id = v.inversion_id and o.fecha = v.fecha and o.precio is not null
    );

  insert into public.inversion_valoraciones (usuario_id, inversion_id, fecha, valor, origen)
  select distinct on (v.inversion_id, v.fecha)
    v.usuario_id, v.inversion_id, v.fecha,
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

  get diagnostics v_valoraciones = row_count;

  -- 4. Los cacheados de cada posición, reconstruidos otra vez desde su libro.
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

  raise notice 'Precios corregidos: %, valoraciones regeneradas: %', v_precios, v_valoraciones;
end;
$$;
