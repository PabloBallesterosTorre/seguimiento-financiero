-- Tanda 10 (corrección): la importación guarda la comisión en su propia columna.
--
-- El importe de un movimiento ya trae la comisión dentro desde la tanda 9, y eso está
-- bien: el coste real de una compra incluye lo que cobra el bróker, y si no contara, la
-- rentabilidad saldría mejor de lo que es. Pero fundida ahí dentro no se puede consultar,
-- así que la operación de inversión la guarda además por separado.
--
-- La retención fiscal NO entra aquí: no es un coste de operar sino un impuesto adelantado.
-- Sigue contando dentro del importe, como hasta ahora.
--
-- Única diferencia con la función de la migración 0022: la clave `comision` de cada fila.

create or replace function public.importar_movimientos(
  p_cuenta_id uuid,
  p_filas jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_usuario uuid := auth.uid();
  v_fila jsonb;
  v_movimiento_id uuid;
  v_importados integer := 0;
  v_conciliados integer := 0;
  v_operaciones integer := 0;
  v_inversiones_nuevas integer := 0;
  v_saldo numeric(14, 2);
  v_isin text;
  v_participaciones numeric(20, 8);
  v_precio numeric(18, 6);
  v_comision numeric(14, 2);
  v_inversion_id uuid;
  v_tocadas uuid[] := '{}';
begin
  if v_usuario is null then
    raise exception 'No autenticado';
  end if;

  -- Se comprueba explícitamente la propiedad de la cuenta además de RLS: si el id no es
  -- del usuario, RLS haría que el `update` final no afectara a ninguna fila y la
  -- importación parecería correcta sin haber cuadrado nada. Mejor fallar claro.
  if not exists (
    select 1 from public.cuentas c where c.id = p_cuenta_id and c.usuario_id = v_usuario
  ) then
    raise exception 'La cuenta % no existe o no pertenece al usuario', p_cuenta_id;
  end if;

  for v_fila in select * from jsonb_array_elements(p_filas)
  loop
    insert into public.movimientos
      (usuario_id, cuenta_id, fecha, descripcion, importe, tipo, categoria_id, origen, moneda)
    values (
      v_usuario,
      p_cuenta_id,
      (v_fila ->> 'fecha')::date,
      v_fila ->> 'descripcion',
      (v_fila ->> 'importe')::numeric,
      v_fila ->> 'tipo',
      nullif(v_fila ->> 'categoria_id', '')::uuid,
      'importado',
      'EUR'
    )
    returning id into v_movimiento_id;

    v_importados := v_importados + 1;

    -- Conciliación con un movimiento previsto, si la fila trae una. Va dentro del mismo
    -- bucle y de la misma transacción: antes esto obligaba a insertar fila a fila desde
    -- el servidor para recuperar el id, que era justo el tramo más frágil.
    if nullif(v_fila ->> 'previsto_id', '') is not null then
      insert into public.previsto_conciliaciones
        (usuario_id, previsto_id, periodo, movimiento_real_id)
      values (
        v_usuario,
        (v_fila ->> 'previsto_id')::uuid,
        date_trunc('month', (v_fila ->> 'fecha')::date)::date,
        v_movimiento_id
      )
      on conflict (previsto_id, periodo)
        do update set movimiento_real_id = excluded.movimiento_real_id;

      v_conciliados := v_conciliados + 1;
    end if;

    -- ---- Operación de inversión ----
    -- Solo cuando la fila trae ISIN Y participaciones: sin cantidad no hay compra ni
    -- venta que registrar, solo efectivo. Un "saveback" de Trade Republic, por ejemplo,
    -- viene asociado a un fondo pero es dinero que entra en la cuenta y todavía no ha
    -- comprado nada — se queda como movimiento normal, que es lo que es.
    v_isin := nullif(v_fila ->> 'isin', '');
    v_participaciones := nullif(v_fila ->> 'participaciones', '')::numeric;

    if v_isin is not null and v_participaciones is not null and v_participaciones <> 0 then
      v_precio := nullif(v_fila ->> 'precio', '')::numeric;
      v_comision := coalesce(nullif(v_fila ->> 'comision', '')::numeric, 0);

      select i.id into v_inversion_id
      from public.inversiones i
      where i.usuario_id = v_usuario and i.isin = v_isin;

      if v_inversion_id is null then
        insert into public.inversiones
          (usuario_id, tipo_activo, nombre, valor_actual, moneda, origen, isin, cuenta_id)
        values (
          v_usuario,
          coalesce(nullif(v_fila ->> 'tipo_activo', ''), 'Fondo indexado'),
          coalesce(nullif(v_fila ->> 'nombre_activo', ''), v_isin),
          0,
          'EUR',
          'manual',
          v_isin,
          p_cuenta_id
        )
        returning id into v_inversion_id;

        v_inversiones_nuevas := v_inversiones_nuevas + 1;
      end if;

      -- El importe de la operación es el del movimiento cambiado de signo: el extracto
      -- lo mira desde la cuenta (una compra es −50) y la operación desde la inversión
      -- (esa misma compra son +50 que entran en ella). Como el importe del movimiento ya
      -- llega con la comisión y la retención incorporadas, el coste que queda registrado
      -- es el coste real, no el nominal.
      insert into public.inversion_operaciones
        (usuario_id, inversion_id, fecha, tipo, importe, participaciones, precio, comision, movimiento_id, origen)
      values (
        v_usuario,
        v_inversion_id,
        (v_fila ->> 'fecha')::date,
        case when v_participaciones > 0 then 'compra' else 'venta' end,
        -(v_fila ->> 'importe')::numeric,
        v_participaciones,
        v_precio,
        v_comision,
        v_movimiento_id,
        'importado'
      );

      v_operaciones := v_operaciones + 1;
      if not (v_inversion_id = any(v_tocadas)) then
        v_tocadas := array_append(v_tocadas, v_inversion_id);
      end if;

      -- El precio de la operación vale para toda la posición a esa fecha, no solo para
      -- lo comprado. Se hace dentro del bucle y en orden de fila para que la última
      -- valoración de cada día sea la que quede.
      if v_precio is not null then
        perform public.revalorizar_inversion(v_inversion_id, (v_fila ->> 'fecha')::date, v_precio);
      end if;
    end if;
  end loop;

  -- Los cacheados de cada inversión tocada se reconstruyen al final, una sola vez por
  -- inversión y con todas sus operaciones ya insertadas.
  for v_inversion_id in select unnest(v_tocadas)
  loop
    perform public.recalcular_inversion(v_inversion_id);
  end loop;

  update public.cuentas c
  set saldo_actual = c.saldo_inicial + coalesce(
    (select sum(m.importe) from public.movimientos m where m.cuenta_id = c.id), 0)
  where c.id = p_cuenta_id
  returning c.saldo_actual into v_saldo;

  return jsonb_build_object(
    'importados', v_importados,
    'conciliados', v_conciliados,
    'operaciones', v_operaciones,
    'inversiones_nuevas', v_inversiones_nuevas,
    'saldo', v_saldo
  );
end;
$$;

grant execute on function public.importar_movimientos(uuid, jsonb) to authenticated;
