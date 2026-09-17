-- Un traspaso entre cuentas propias podía tener cuenta origen, destino e importe, pero
-- nunca categoría: al vincular dos movimientos como traspaso se les borraba
-- (`categoria_id: null`) y la pantalla de movimientos ni siquiera ofrecía el selector.
--
-- El problema es que eso obligaba a elegir entre dos cosas incompatibles cuando un gasto
-- conjunto se paga desde una cuenta personal y se repone desde la común:
--
--   a) Dejar las dos patas como gasto e ingreso sueltos, con su categoría. La cuenta común
--      dice bien qué gastó y en qué, pero mirando todas las cuentas a la vez el mismo gasto
--      se cuenta dos veces (el pago real y la reposición) y la reposición aparece como un
--      ingreso que no existe.
--   b) Marcarlas como traspaso. El agregado sale bien —`filtrarMovimientosPorCuentasSeleccionadas`
--      ya anula el traspaso cuando las dos cuentas están seleccionadas, y lo trata como gasto
--      o ingreso real cuando solo lo está una— pero se perdía la categoría, así que esos
--      importes desaparecían del desglose por categorías.
--
-- Permitiendo categoría en el traspaso se obtienen las dos a la vez: mirando solo la cuenta
-- común, el traspaso cuenta como gasto en su categoría; mirando todas, se anula y queda solo
-- el gasto real. La columna `categoria_id` ya existe en `movimientos` y no hace falta tocar
-- el esquema: lo único que cambia es que `importar_traspasos` deja de ignorarla.

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
  v_categoria uuid;
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
    v_categoria := nullif(v_fila ->> 'categoria_id', '')::uuid;

    if v_contraparte = p_cuenta_id then
      raise exception 'Un traspaso no puede tener la misma cuenta de origen y destino';
    end if;

    if not exists (
      select 1 from public.cuentas c where c.id = v_contraparte and c.usuario_id = v_usuario
    ) then
      raise exception 'La cuenta contraparte % no existe o no pertenece al usuario', v_contraparte;
    end if;

    v_grupo := gen_random_uuid();

    -- La categoría se guarda en las DOS patas. Da igual cuál de las dos cuentas mires: si
    -- solo una está seleccionada, esa pata se reclasifica a gasto o ingreso y aparece en su
    -- categoría; si están las dos, el traspaso se anula entero y la categoría no se usa.
    insert into public.movimientos
      (usuario_id, cuenta_id, fecha, descripcion, importe, tipo, categoria_id, origen, moneda, traspaso_grupo_id)
    values
      (v_usuario, p_cuenta_id, (v_fila ->> 'fecha')::date, v_fila ->> 'descripcion',
       v_importe, 'traspaso', v_categoria, 'importado', 'EUR', v_grupo),
      (v_usuario, v_contraparte, (v_fila ->> 'fecha')::date, v_fila ->> 'descripcion',
       -v_importe, 'traspaso', v_categoria, 'importado', 'EUR', v_grupo);

    v_importados := v_importados + 1;
  end loop;

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

grant execute on function public.importar_traspasos(uuid, jsonb) to authenticated;
