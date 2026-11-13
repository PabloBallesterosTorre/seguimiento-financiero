-- Tanda 17: servidor MCP propio, para consultar la app (y apuntar movimientos) desde Claude.
--
-- Autenticación con claves personales: el usuario genera una en Configuración, la copia una
-- sola vez y la pone en la configuración de Claude Code. Aquí solo se guarda su hash
-- SHA-256; la clave en claro no vuelve a existir en ningún sitio más que en su máquina.
--
-- Por qué funciones SECURITY DEFINER y no la service-role key: el proyecto tiene la regla de
-- que la service-role key no se usa para leer ni escribir datos de usuario (ver
-- lib/supabase/admin.ts). Una petición MCP no trae sesión de Supabase, así que RLS no puede
-- saber quién es. Estas funciones resuelven el usuario A PARTIR DE LA CLAVE, dentro de la
-- base de datos, y filtran por él en cada consulta: quien llama no puede elegir el usuario,
-- solo presentar una clave. La ruta /api/mcp las llama con la anon key, como cualquier
-- cliente público.

create table if not exists public.claves_api (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  nombre text not null check (length(trim(nombre)) > 0),
  -- Los primeros caracteres de la clave, para reconocerla en la lista sin guardarla.
  prefijo text not null,
  hash text not null unique,
  permiso text not null default 'lectura' check (permiso in ('lectura', 'escritura')),
  created_at timestamptz not null default now(),
  ultimo_uso timestamptz,
  revocada_at timestamptz
);

alter table public.claves_api enable row level security;

create policy "claves_api: select propias" on public.claves_api
  for select using (auth.uid() = usuario_id);
create policy "claves_api: insert propias" on public.claves_api
  for insert with check (auth.uid() = usuario_id);
create policy "claves_api: update propias" on public.claves_api
  for update using (auth.uid() = usuario_id);
create policy "claves_api: delete propias" on public.claves_api
  for delete using (auth.uid() = usuario_id);

-- ============ Resolución de la clave (interna) ============
-- No se concede a nadie: solo la usan las funciones mcp_* de abajo, que son SECURITY
-- DEFINER y por tanto la ejecutan con los permisos de su dueño.
create or replace function public.mcp_usuario(p_clave text, p_escritura boolean default false)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_clave public.claves_api;
begin
  select * into v_clave from public.claves_api
  where hash = encode(extensions.digest(coalesce(p_clave, ''), 'sha256'), 'hex')
    and revocada_at is null;

  if v_clave.id is null then
    raise exception 'Clave no válida o revocada' using errcode = '28000';
  end if;
  if p_escritura and v_clave.permiso <> 'escritura' then
    raise exception 'Esta clave es de solo lectura' using errcode = '42501';
  end if;

  update public.claves_api set ultimo_uso = now() where id = v_clave.id;
  return v_clave.usuario_id;
end;
$$;

revoke all on function public.mcp_usuario(text, boolean) from public, anon, authenticated;

-- Nombre legible de una categoría: "Padre › Hija" para las subcategorías.
create or replace function public.mcp_nombre_categoria(p_categoria_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case when p.id is null then c.nombre else p.nombre || ' › ' || c.nombre end
  from public.categorias c left join public.categorias p on p.id = c.categoria_padre_id
  where c.id = p_categoria_id;
$$;

revoke all on function public.mcp_nombre_categoria(uuid) from public, anon, authenticated;

-- Busca una categoría del usuario por nombre, sin distinguir mayúsculas. Acepta también
-- "Padre › Hija" o "Padre > Hija". Si el nombre es ambiguo, falla diciendo cuáles hay.
create or replace function public.mcp_resolver_categoria(p_usuario uuid, p_nombre text)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
  v_hija text := trim(regexp_replace(p_nombre, '^.*(›|>)', ''));
  v_padre text := nullif(trim(substring(p_nombre from '^(.*)(›|>)')), '');
begin
  select array_agg(c.id) into v_ids
  from public.categorias c left join public.categorias p on p.id = c.categoria_padre_id
  where c.usuario_id = p_usuario
    and lower(c.nombre) = lower(v_hija)
    and (v_padre is null or lower(p.nombre) = lower(trim(regexp_replace(v_padre, '(›|>)$', ''))));

  if v_ids is null then
    raise exception 'No existe la categoría "%"', p_nombre;
  end if;
  if array_length(v_ids, 1) > 1 then
    raise exception 'Hay varias categorías "%": usa "Padre › Hija"', p_nombre;
  end if;
  return v_ids[1];
end;
$$;

revoke all on function public.mcp_resolver_categoria(uuid, text) from public, anon, authenticated;

-- ============ Herramientas de lectura ============

create or replace function public.mcp_cuentas(p_clave text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  u uuid := public.mcp_usuario(p_clave);
begin
  return jsonb_build_object(
    'cuentas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'banco', c.banco_nombre, 'nombre', c.nombre, 'ambito', c.ambito,
        'saldo', c.saldo_actual, 'moneda', c.moneda) order by c.banco_nombre, c.nombre)
      from public.cuentas c where c.usuario_id = u and c.activa), '[]'::jsonb),
    'total', (select coalesce(sum(saldo_actual), 0) from public.cuentas where usuario_id = u and activa)
  );
end;
$$;

create or replace function public.mcp_catalogo(p_clave text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  u uuid := public.mcp_usuario(p_clave);
begin
  return jsonb_build_object(
    'categorias', coalesce((
      select jsonb_agg(public.mcp_nombre_categoria(c.id) order by public.mcp_nombre_categoria(c.id))
      from public.categorias c where c.usuario_id = u), '[]'::jsonb),
    'etiquetas', coalesce((
      select jsonb_agg(e.nombre order by e.nombre) from public.etiquetas e where e.usuario_id = u), '[]'::jsonb),
    'cuentas', coalesce((
      select jsonb_agg(c.banco_nombre || ' — ' || c.nombre order by c.banco_nombre, c.nombre)
      from public.cuentas c where c.usuario_id = u and c.activa), '[]'::jsonb)
  );
end;
$$;

create or replace function public.mcp_movimientos(
  p_clave text,
  p_desde date default null,
  p_hasta date default null,
  p_texto text default null,
  p_categoria text default null,
  p_etiqueta text default null,
  p_limite integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  u uuid := public.mcp_usuario(p_clave);
  v_categoria uuid := case when p_categoria is null then null else public.mcp_resolver_categoria(u, p_categoria) end;
  v_limite integer := least(greatest(coalesce(p_limite, 50), 1), 500);
begin
  return coalesce((
    select jsonb_agg(fila order by (fila->>'fecha') desc)
    from (
      select jsonb_build_object(
        'id', m.id,
        'fecha', m.fecha,
        'descripcion', m.descripcion,
        'importe', m.importe,
        'tipo', m.tipo,
        'cuenta', c.banco_nombre || ' — ' || c.nombre,
        'categoria', public.mcp_nombre_categoria(m.categoria_id),
        'etiquetas', coalesce((
          select jsonb_agg(e.nombre) from public.movimiento_etiquetas me
          join public.etiquetas e on e.id = me.etiqueta_id where me.movimiento_id = m.id), '[]'::jsonb)
      ) as fila
      from public.movimientos m
      join public.cuentas c on c.id = m.cuenta_id
      left join public.categorias cat on cat.id = m.categoria_id
      where m.usuario_id = u
        and (p_desde is null or m.fecha >= p_desde)
        and (p_hasta is null or m.fecha <= p_hasta)
        and (p_texto is null or m.descripcion ilike '%' || p_texto || '%')
        and (v_categoria is null or m.categoria_id = v_categoria or cat.categoria_padre_id = v_categoria)
        and (p_etiqueta is null or exists (
          select 1 from public.movimiento_etiquetas me join public.etiquetas e on e.id = me.etiqueta_id
          where me.movimiento_id = m.id and lower(e.nombre) = lower(p_etiqueta)))
      order by m.fecha desc, m.created_at desc
      limit v_limite
    ) t
  ), '[]'::jsonb);
end;
$$;

-- Gasto e ingreso por categoría (agrupado en la categoría madre) en un periodo. Los
-- traspasos no cuentan: mueven dinero entre cuentas propias.
create or replace function public.mcp_resumen_categorias(p_clave text, p_desde date, p_hasta date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  u uuid := public.mcp_usuario(p_clave);
begin
  return jsonb_build_object(
    'desde', p_desde, 'hasta', p_hasta,
    'categorias', coalesce((
      select jsonb_agg(jsonb_build_object('categoria', nombre, 'neto', neto, 'movimientos', n) order by neto)
      from (
        select coalesce(p.nombre, c.nombre, 'Sin categoría') as nombre, sum(m.importe) as neto, count(*) as n
        from public.movimientos m
        left join public.categorias c on c.id = m.categoria_id
        left join public.categorias p on p.id = c.categoria_padre_id
        where m.usuario_id = u and m.tipo <> 'traspaso' and m.fecha between p_desde and p_hasta
        group by 1
      ) t), '[]'::jsonb),
    'total_gastos', (select coalesce(-sum(importe), 0) from public.movimientos
      where usuario_id = u and tipo <> 'traspaso' and importe < 0 and fecha between p_desde and p_hasta),
    'total_ingresos', (select coalesce(sum(importe), 0) from public.movimientos
      where usuario_id = u and tipo <> 'traspaso' and importe > 0 and fecha between p_desde and p_hasta)
  );
end;
$$;

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
  v_deuda numeric := (select coalesce(sum(capital_pendiente), 0) from public.deudas where usuario_id = u);
begin
  return jsonb_build_object(
    'cuentas', v_cuentas, 'inversion', v_inversion, 'deuda', v_deuda,
    'patrimonio_neto', v_cuentas + v_inversion - v_deuda,
    'inversiones', coalesce((
      select jsonb_agg(jsonb_build_object(
        'nombre', i.nombre, 'tipo', i.tipo_activo, 'valor', i.valor_actual,
        'aportado_neto', i.coste_neto, 'ganancia', i.valor_actual - i.coste_neto,
        'participaciones', i.participaciones, 'actualizado', i.fecha_actualizacion::date)
        order by i.valor_actual desc)
      from public.inversiones i where i.usuario_id = u), '[]'::jsonb),
    'deudas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'nombre', d.nombre, 'tipo', d.tipo, 'pendiente', d.capital_pendiente, 'cuota', d.cuota,
        'periodicidad', d.periodicidad, 'interes', d.tipo_interes, 'fin', d.fecha_fin)
        order by d.capital_pendiente desc)
      from public.deudas d where d.usuario_id = u), '[]'::jsonb)
  );
end;
$$;

create or replace function public.mcp_previstos(p_clave text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  u uuid := public.mcp_usuario(p_clave);
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'descripcion', p.descripcion, 'tipo', p.tipo, 'importe', p.importe_estimado,
      'recurrencia', p.tipo_recurrencia, 'periodicidad', p.periodicidad,
      'fecha', p.fecha, 'desde', p.fecha_inicio, 'hasta', p.fecha_fin,
      'presupuesto', p.es_presupuesto, 'categoria', public.mcp_nombre_categoria(p.categoria_id))
      order by p.descripcion)
    from public.movimientos_previstos p where p.usuario_id = u and p.estado = 'activo'), '[]'::jsonb);
end;
$$;

-- ============ Herramientas de escritura (solo claves con permiso de escritura) ============

-- Pone las etiquetas indicadas (por nombre, creándolas si no existen) a un movimiento.
create or replace function public.mcp_poner_etiquetas(p_usuario uuid, p_movimiento uuid, p_etiquetas text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre text;
  v_etiqueta uuid;
begin
  foreach v_nombre in array coalesce(p_etiquetas, '{}') loop
    continue when trim(v_nombre) = '';
    select id into v_etiqueta from public.etiquetas where usuario_id = p_usuario and lower(nombre) = lower(trim(v_nombre));
    if v_etiqueta is null then
      insert into public.etiquetas (usuario_id, nombre) values (p_usuario, trim(v_nombre)) returning id into v_etiqueta;
    end if;
    insert into public.movimiento_etiquetas (movimiento_id, etiqueta_id, usuario_id, origen)
    values (p_movimiento, v_etiqueta, p_usuario, 'manual') on conflict do nothing;
    v_etiqueta := null;
  end loop;
end;
$$;

revoke all on function public.mcp_poner_etiquetas(uuid, uuid, text[]) from public, anon, authenticated;

create or replace function public.mcp_crear_movimiento(
  p_clave text,
  p_cuenta text,
  p_fecha date,
  p_descripcion text,
  p_importe numeric,
  p_categoria text default null,
  p_etiquetas text[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  u uuid := public.mcp_usuario(p_clave, true);
  v_cuentas uuid[];
  v_cuenta uuid;
  v_categoria uuid := case when p_categoria is null then null else public.mcp_resolver_categoria(u, p_categoria) end;
  v_id uuid;
begin
  if p_importe is null or p_importe = 0 then
    raise exception 'El importe no puede ser cero: negativo para un gasto, positivo para un ingreso';
  end if;
  if coalesce(trim(p_descripcion), '') = '' then
    raise exception 'Falta la descripción';
  end if;

  -- La cuenta se busca por su nombre, por "Banco — Nombre" o por su id, siempre entre
  -- las del usuario de la clave.
  select array_agg(id) into v_cuentas from public.cuentas
  where usuario_id = u and activa
    and (id::text = p_cuenta or lower(nombre) = lower(trim(p_cuenta))
         or lower(banco_nombre || ' — ' || nombre) = lower(trim(p_cuenta)));
  if v_cuentas is null then
    raise exception 'No existe la cuenta "%"', p_cuenta;
  end if;
  if array_length(v_cuentas, 1) > 1 then
    raise exception 'Hay varias cuentas "%": usa "Banco — Nombre"', p_cuenta;
  end if;
  v_cuenta := v_cuentas[1];

  insert into public.movimientos (usuario_id, cuenta_id, fecha, descripcion, importe, tipo, categoria_id, origen, moneda)
  values (u, v_cuenta, coalesce(p_fecha, current_date), trim(p_descripcion), round(p_importe, 2),
          case when p_importe < 0 then 'gasto' else 'ingreso' end, v_categoria, 'manual', 'EUR')
  returning id into v_id;

  -- Mismo criterio que reconstruirSaldo (lib/saldos.ts): el saldo se reconstruye desde el
  -- saldo inicial y todos los movimientos, no se le suma el importe.
  update public.cuentas c set saldo_actual = c.saldo_inicial
    + coalesce((select sum(m.importe) from public.movimientos m where m.cuenta_id = c.id), 0)
  where c.id = v_cuenta;

  perform public.mcp_poner_etiquetas(u, v_id, p_etiquetas);

  return jsonb_build_object('id', v_id, 'creado', true,
    'saldo_cuenta', (select saldo_actual from public.cuentas where id = v_cuenta));
end;
$$;

create or replace function public.mcp_categorizar_movimiento(
  p_clave text,
  p_movimiento uuid,
  p_categoria text default null,
  p_etiquetas text[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  u uuid := public.mcp_usuario(p_clave, true);
begin
  if not exists (select 1 from public.movimientos where id = p_movimiento and usuario_id = u) then
    raise exception 'No existe ese movimiento';
  end if;
  if p_categoria is not null then
    update public.movimientos set categoria_id = public.mcp_resolver_categoria(u, p_categoria)
    where id = p_movimiento and usuario_id = u;
  end if;
  perform public.mcp_poner_etiquetas(u, p_movimiento, p_etiquetas);
  return jsonb_build_object('id', p_movimiento, 'actualizado', true,
    'categoria', (select public.mcp_nombre_categoria(categoria_id) from public.movimientos where id = p_movimiento));
end;
$$;

-- Solo las herramientas públicas se pueden llamar desde fuera, con la anon key.
grant execute on function public.mcp_cuentas(text) to anon, authenticated;
grant execute on function public.mcp_catalogo(text) to anon, authenticated;
grant execute on function public.mcp_movimientos(text, date, date, text, text, text, integer) to anon, authenticated;
grant execute on function public.mcp_resumen_categorias(text, date, date) to anon, authenticated;
grant execute on function public.mcp_patrimonio(text) to anon, authenticated;
grant execute on function public.mcp_previstos(text) to anon, authenticated;
grant execute on function public.mcp_crear_movimiento(text, text, date, text, numeric, text, text[]) to anon, authenticated;
grant execute on function public.mcp_categorizar_movimiento(text, uuid, text, text[]) to anon, authenticated;
