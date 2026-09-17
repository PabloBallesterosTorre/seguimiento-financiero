-- Tanda 12: la conciliación que escribe la importación se guarda con la FECHA del
-- movimiento, no con el día 1 de su mes.
--
-- La clave única de previsto_conciliaciones es (previsto_id, periodo). Con el día 1 fijo,
-- un previsto solo podía tener UNA conciliación por mes. Las tres aportaciones a inversión
-- son semanales y ocurren cuatro o cinco veces al mes: al importarlas, la segunda pisaba a
-- la primera por el `on conflict do update`, y las demás desaparecían.
--
-- Guardando la fecha del movimiento, cada ocurrencia tiene su conciliación. El mes sigue
-- siendo el mismo para todo lo que agrupa por periodo, porque todos esos sitios se quedan
-- con los siete primeros caracteres (o lo traducen al mes financiero).
--
-- Es el mismo cambio que ya se hizo en vincularMovimientoPrevisto; esto lo alinea en la
-- ruta de importación, que es por donde entra casi todo.
--
-- La función se redefine entera (Postgres no deja parchear una línea) y sigue siendo
-- SECURITY INVOKER: la RLS tiene que seguir aplicándose, como en toda la app.

create or replace function public.importar_movimientos(p_cuenta_id uuid, p_filas jsonb)
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
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

    if nullif(v_fila ->> 'previsto_id', '') is not null then
      insert into public.previsto_conciliaciones
        (usuario_id, previsto_id, periodo, movimiento_real_id)
      values (
        v_usuario,
        (v_fila ->> 'previsto_id')::uuid,
        -- Antes: date_trunc('month', ...). Ver la cabecera del fichero.
        (v_fila ->> 'fecha')::date,
        v_movimiento_id
      )
      on conflict (previsto_id, periodo)
        do update set movimiento_real_id = excluded.movimiento_real_id;

      v_conciliados := v_conciliados + 1;
    end if;

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

      if v_precio is not null then
        perform public.revalorizar_inversion(v_inversion_id, (v_fila ->> 'fecha')::date, v_precio);
      end if;
    end if;
  end loop;

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
$function$;
