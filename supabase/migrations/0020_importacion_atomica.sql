-- La importación no era atómica: insertaba los movimientos y DESPUÉS actualizaba el
-- saldo, en llamadas separadas desde el servidor de Next. Si fallaba a mitad —sobre todo
-- en el bucle fila a fila de las conciliaciones— quedaban movimientos insertados y el
-- saldo sin actualizar, descuadrando la cuenta en silencio. Esa es exactamente la clase
-- de fallo que dejó la cuenta de Trade Republic con 123,33 € de desfase.
--
-- Estas dos funciones mueven la importación entera dentro de la base de datos, donde cada
-- una se ejecuta en una única transacción: o entra todo, o no entra nada.
--
-- Dos decisiones importantes:
--
-- 1. `security invoker` (el valor por defecto, explícito aquí para que se lea): la función
--    corre con los permisos de quien la llama, así que TODAS las políticas RLS siguen
--    aplicando. Un usuario no puede insertar movimientos en cuentas ajenas ni tocar saldos
--    que no son suyos. Una función `security definer` habría saltado RLS, que es justo el
--    agujero por el que 101 movimientos acabaron en una cuenta que no les correspondía.
--
-- 2. El saldo se RECONSTRUYE (`saldo_inicial` + suma de movimientos) en vez de sumarle el
--    neto del lote al valor anterior. Así la importación no solo no puede descuadrar la
--    cuenta: la deja cuadrada aunque viniera descuadrada de antes. Es autocorrectiva.

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
  v_saldo numeric(14, 2);
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
  end loop;

  update public.cuentas c
  set saldo_actual = c.saldo_inicial + coalesce(
    (select sum(m.importe) from public.movimientos m where m.cuenta_id = c.id), 0)
  where c.id = p_cuenta_id
  returning c.saldo_actual into v_saldo;

  return jsonb_build_object(
    'importados', v_importados,
    'conciliados', v_conciliados,
    'saldo', v_saldo
  );
end;
$$;

-- Un traspaso entre cuentas propias son dos movimientos enlazados más dos saldos. Antes
-- eran cuatro escrituras sueltas: si fallaba cualquiera intermedia, quedaba medio traspaso
-- registrado o un saldo movido sin su pareja.
create or replace function public.importar_traspasos(
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
  v_contraparte uuid;
  v_importe numeric(14, 2);
  v_grupo uuid;
  v_importados integer := 0;
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
    v_contraparte := (v_fila ->> 'cuenta_contraparte_id')::uuid;
    v_importe := (v_fila ->> 'importe')::numeric;

    if v_contraparte = p_cuenta_id then
      raise exception 'Un traspaso no puede tener la misma cuenta de origen y destino';
    end if;

    if not exists (
      select 1 from public.cuentas c where c.id = v_contraparte and c.usuario_id = v_usuario
    ) then
      raise exception 'La cuenta contraparte % no existe o no pertenece al usuario', v_contraparte;
    end if;

    v_grupo := gen_random_uuid();

    -- Dos filas, una por cuenta, cada una con el signo correcto para la suya: así el
    -- listado ya muestra negativo en el origen y positivo en el destino sin lógica
    -- especial de renderizado. `p_filas.importe` viene con el signo visto desde
    -- p_cuenta_id, y la contraparte recibe el opuesto.
    insert into public.movimientos
      (usuario_id, cuenta_id, fecha, descripcion, importe, tipo, origen, moneda, traspaso_grupo_id)
    values
      (v_usuario, p_cuenta_id, (v_fila ->> 'fecha')::date, v_fila ->> 'descripcion',
       v_importe, 'traspaso', 'importado', 'EUR', v_grupo),
      (v_usuario, v_contraparte, (v_fila ->> 'fecha')::date, v_fila ->> 'descripcion',
       -v_importe, 'traspaso', 'importado', 'EUR', v_grupo);

    v_importados := v_importados + 1;
  end loop;

  -- Se reconstruyen los saldos de la cuenta y de todas las contrapartes implicadas.
  update public.cuentas c
  set saldo_actual = c.saldo_inicial + coalesce(
    (select sum(m.importe) from public.movimientos m where m.cuenta_id = c.id), 0)
  where c.id = p_cuenta_id
     or c.id in (
       select (f ->> 'cuenta_contraparte_id')::uuid from jsonb_array_elements(p_filas) f
     );

  return jsonb_build_object('importados', v_importados);
end;
$$;

grant execute on function public.importar_movimientos(uuid, jsonb) to authenticated;
grant execute on function public.importar_traspasos(uuid, jsonb) to authenticated;
