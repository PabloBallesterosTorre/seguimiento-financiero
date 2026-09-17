-- Tanda 10: la inversión deja de ser un número tecleado a mano y pasa a ser una
-- posición con su libro de operaciones.
--
-- Hasta ahora una inversión solo sabía cuánto VALE (valor_actual + histórico de
-- valoraciones manuales). No sabía cuánto se había METIDO, así que no podía calcular
-- ninguna rentabilidad real: solo existía la `rentabilidad_anual_asumida`, que es un
-- supuesto. Con el libro de operaciones sí se puede: aportado neto, ganancia,
-- rentabilidad simple y TIR anualizada (lib/inversiones.ts).
--
-- El disparador de este diseño es que el extracto de Trade Republic ya trae, en
-- columnas propias, el ISIN (`symbol`), las participaciones (`shares`) y el precio
-- unitario (`price`) de cada operación. O sea: la cartera se puede alimentar sola al
-- importar, sin teclear nada y sin depender de una API de precios externa (que sigue
-- siendo fase 2). Cada ejecución de un plan de ahorro trae, además, un precio real de
-- mercado de ese día, con el que se revaloriza la posición entera.

-- ============ 1. La inversión, como posición ============
alter table public.inversiones
  -- Identificador del activo en el extracto. Es la clave con la que una fila importada
  -- encuentra su posición; por eso es único por usuario (pero opcional: una inversión
  -- puede no cotizar — un depósito, un inmueble — y seguir siendo una inversión).
  add column if not exists isin text,
  -- Dónde está custodiada. Informativo: el valor de la inversión NO suma al saldo de la
  -- cuenta, suma aparte al patrimonio. Sirve para saber de qué extracto vendrá.
  add column if not exists cuenta_id uuid references public.cuentas(id) on delete set null,
  -- Los dos derivados del libro de operaciones, cacheados igual que ya se cachea
  -- valor_actual. La única fuente de verdad son las operaciones; estos campos los
  -- recalcula siempre recalcular_inversion(), nunca se escriben a mano.
  add column if not exists participaciones numeric(20, 8) not null default 0,
  add column if not exists coste_neto numeric(14, 2) not null default 0;

create unique index if not exists inversiones_usuario_isin_idx
  on public.inversiones (usuario_id, isin)
  where isin is not null;

-- ============ 2. El libro de operaciones ============
create table if not exists public.inversion_operaciones (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  inversion_id uuid not null references public.inversiones(id) on delete cascade,
  fecha date not null,
  tipo text not null check (tipo in ('compra', 'venta', 'aportacion', 'retirada', 'dividendo', 'ajuste')),
  -- Efectivo movido, visto desde la inversión: POSITIVO cuando el dinero entra en ella
  -- (compra, aportación) y NEGATIVO cuando sale (venta, retirada, dividendo cobrado).
  -- Es el signo contrario al del movimiento bancario, que se mira desde la cuenta.
  importe numeric(14, 2) not null,
  -- +compra / −venta. Null cuando la inversión no se mide en participaciones (un
  -- depósito, una aportación a un producto opaco): esas operaciones aportan coste pero
  -- no cantidad, y el precio medio simplemente no aplica.
  participaciones numeric(20, 8),
  precio numeric(18, 6),
  comision numeric(14, 2) not null default 0,
  -- El vínculo con el extracto. Nullable a propósito: hay operaciones que no tocan
  -- ninguna cuenta registrada (un dividendo reinvertido dentro del fondo, un traspaso
  -- entre fondos, una posición custodiada fuera de la app).
  movimiento_id uuid references public.movimientos(id) on delete set null,
  origen text not null default 'manual' check (origen in ('manual', 'importado')),
  nota text,
  created_at timestamptz not null default now(),
  -- Un movimiento no puede generar dos operaciones. Postgres permite varios NULL en un
  -- índice único, así que esto no estorba a las operaciones sin movimiento asociado.
  unique (movimiento_id)
);

create index if not exists inversion_operaciones_inversion_id_idx on public.inversion_operaciones (inversion_id);
create index if not exists inversion_operaciones_fecha_idx on public.inversion_operaciones (fecha);

alter table public.inversion_operaciones enable row level security;

create policy "inversion_operaciones: select propias" on public.inversion_operaciones
  for select using (auth.uid() = usuario_id);
create policy "inversion_operaciones: insert propias" on public.inversion_operaciones
  for insert with check (auth.uid() = usuario_id);
create policy "inversion_operaciones: update propias" on public.inversion_operaciones
  for update using (auth.uid() = usuario_id);
create policy "inversion_operaciones: delete propias" on public.inversion_operaciones
  for delete using (auth.uid() = usuario_id);

-- ============ 3. Recálculo de la posición ============
-- Mismo criterio que `reconstruirSaldo` para las cuentas (tanda 9): los campos cacheados
-- se RECONSTRUYEN desde su fuente de verdad en vez de irse sumando, así que cualquier
-- deriva anterior se repara sola en la siguiente operación.
--
-- `coste_neto` es el flujo de caja neto: aportaciones menos retiradas. No es el coste
-- fiscal de las participaciones que quedan. Se elige a propósito porque es lo que hace
-- que `valor_actual − coste_neto` sea la ganancia TOTAL (realizada + latente), que es la
-- cifra que el usuario quiere ver. El precio medio de compra, que sí necesita mirar solo
-- las compras, se calcula aparte en lib/inversiones.ts.
create or replace function public.recalcular_inversion(p_inversion_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
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
        where v.inversion_id = i.id order by v.fecha desc limit 1), i.fecha_actualizacion)
  where i.id = p_inversion_id;
end;
$$;

-- Revaloriza la posición entera a un precio unitario conocido de una fecha concreta.
-- Es lo que convierte cada ejecución de un plan de ahorro en un punto real de mercado:
-- el extracto trae el precio al que se compró ese día, y ese precio vale para TODAS las
-- participaciones que se tuvieran en ese momento, no solo para las compradas.
--
-- Nunca pisa una valoración introducida a mano: si ya hay un punto 'manual' ese día,
-- gana el manual. Lo que el usuario teclea explícitamente tiene prioridad sobre lo que
-- la app deduce.
create or replace function public.revalorizar_inversion(
  p_inversion_id uuid,
  p_fecha date,
  p_precio numeric
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_usuario uuid := auth.uid();
  v_participaciones numeric(20, 8);
  v_con_participaciones integer;
begin
  if p_precio is null or p_precio <= 0 then
    return;
  end if;

  select coalesce(sum(o.participaciones), 0), count(*) filter (where o.participaciones is not null)
    into v_participaciones, v_con_participaciones
  from public.inversion_operaciones o
  where o.inversion_id = p_inversion_id and o.fecha <= p_fecha;

  -- Una inversión que no se mide en participaciones (un depósito, un producto opaco al
  -- que solo se le hacen aportaciones) no se puede valorar por precio unitario: su valor
  -- es el que se teclee a mano. Sin esta guarda, un precio suelto la dejaría valorada a
  -- cero, que es justo lo contrario de lo que se quiere.
  if v_con_participaciones = 0 then
    return;
  end if;

  insert into public.inversion_valoraciones (usuario_id, inversion_id, fecha, valor, origen)
  -- Cuando las participaciones netas son cero la posición está CERRADA: se ha vendido
  -- entera y su valor de mercado es cero, no el que tenía antes de la venta. Sin este
  -- caso, una posición liquidada seguiría contando en el patrimonio por su último valor
  -- conocido — el dinero estaría dos veces, en la cuenta y en la inversión.
  values (v_usuario, p_inversion_id, p_fecha,
          case when v_participaciones > 0 then round(v_participaciones * p_precio, 2) else 0 end,
          'automatico')
  on conflict (inversion_id, fecha) do update
    set valor = excluded.valor
    where public.inversion_valoraciones.origen = 'automatico';
end;
$$;

grant execute on function public.recalcular_inversion(uuid) to authenticated;
grant execute on function public.revalorizar_inversion(uuid, date, numeric) to authenticated;

-- ============ 4. La importación alimenta la cartera ============
-- Se reescribe `importar_movimientos` (migración 0020) para que, además del movimiento,
-- cree su operación de inversión cuando la fila trae ISIN y participaciones. Todo dentro
-- de la misma transacción que ya tenía: o entra el movimiento con su operación y el
-- saldo, o no entra nada.
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
        (usuario_id, inversion_id, fecha, tipo, importe, participaciones, precio, movimiento_id, origen)
      values (
        v_usuario,
        v_inversion_id,
        (v_fila ->> 'fecha')::date,
        case when v_participaciones > 0 then 'compra' else 'venta' end,
        -(v_fila ->> 'importe')::numeric,
        v_participaciones,
        v_precio,
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
