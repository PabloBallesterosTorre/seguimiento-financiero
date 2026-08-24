-- Esquema inicial: Seguimiento Financiero (MVP)
-- Simplificación respecto al análisis funcional: en vez de una tabla "bancos" aparte,
-- cada cuenta guarda el nombre del banco como texto libre (banco_nombre). Se puede
-- normalizar más adelante si hace falta (p.ej. para logos o entidades compartidas).

-- ============ CUENTAS ============
create table if not exists public.cuentas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  banco_nombre text not null,
  nombre text not null,
  tipo text not null default 'corriente' check (tipo in ('corriente', 'ahorro', 'conjunta')),
  moneda text not null default 'EUR',
  saldo_actual numeric(14, 2) not null default 0,
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.cuentas enable row level security;

create policy "cuentas: select propias" on public.cuentas
  for select using (auth.uid() = usuario_id);
create policy "cuentas: insert propias" on public.cuentas
  for insert with check (auth.uid() = usuario_id);
create policy "cuentas: update propias" on public.cuentas
  for update using (auth.uid() = usuario_id);
create policy "cuentas: delete propias" on public.cuentas
  for delete using (auth.uid() = usuario_id);

-- ============ CATEGORÍAS ============
create table if not exists public.categorias (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  nombre text not null,
  tipo text not null check (tipo in ('ingreso', 'gasto')),
  categoria_padre_id uuid references public.categorias(id) on delete set null,
  es_categoria_inversion boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.categorias enable row level security;

create policy "categorias: select propias" on public.categorias
  for select using (auth.uid() = usuario_id);
create policy "categorias: insert propias" on public.categorias
  for insert with check (auth.uid() = usuario_id);
create policy "categorias: update propias" on public.categorias
  for update using (auth.uid() = usuario_id);
create policy "categorias: delete propias" on public.categorias
  for delete using (auth.uid() = usuario_id);

-- ============ MOVIMIENTOS ============
create table if not exists public.movimientos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  cuenta_id uuid not null references public.cuentas(id) on delete cascade,
  fecha date not null,
  descripcion text not null,
  importe numeric(14, 2) not null,
  tipo text not null check (tipo in ('ingreso', 'gasto')),
  categoria_id uuid references public.categorias(id) on delete set null,
  subcategoria_id uuid references public.categorias(id) on delete set null,
  origen text not null default 'manual' check (origen in ('manual', 'importado')),
  moneda text not null default 'EUR',
  created_at timestamptz not null default now()
);

create index if not exists movimientos_cuenta_id_idx on public.movimientos (cuenta_id);
create index if not exists movimientos_fecha_idx on public.movimientos (fecha);

alter table public.movimientos enable row level security;

create policy "movimientos: select propios" on public.movimientos
  for select using (auth.uid() = usuario_id);
create policy "movimientos: insert propios" on public.movimientos
  for insert with check (auth.uid() = usuario_id);
create policy "movimientos: update propios" on public.movimientos
  for update using (auth.uid() = usuario_id);
create policy "movimientos: delete propios" on public.movimientos
  for delete using (auth.uid() = usuario_id);

-- ============ REGLAS DE CATEGORIZACIÓN (motor de aprendizaje) ============
create table if not exists public.reglas_categorizacion (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  patron_descripcion text not null,
  categoria_id uuid not null references public.categorias(id) on delete cascade,
  subcategoria_id uuid references public.categorias(id) on delete set null,
  veces_usada integer not null default 1,
  ultima_fecha_uso timestamptz not null default now()
);

alter table public.reglas_categorizacion enable row level security;

create policy "reglas: select propias" on public.reglas_categorizacion
  for select using (auth.uid() = usuario_id);
create policy "reglas: insert propias" on public.reglas_categorizacion
  for insert with check (auth.uid() = usuario_id);
create policy "reglas: update propias" on public.reglas_categorizacion
  for update using (auth.uid() = usuario_id);
create policy "reglas: delete propias" on public.reglas_categorizacion
  for delete using (auth.uid() = usuario_id);

-- ============ INVERSIÓN ============
create table if not exists public.inversiones (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  tipo_activo text not null,
  nombre text not null,
  valor_actual numeric(14, 2) not null default 0,
  moneda text not null default 'EUR',
  origen text not null default 'manual' check (origen in ('manual', 'sync')),
  movimiento_origen_id uuid references public.movimientos(id) on delete set null,
  fecha_actualizacion timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.inversiones enable row level security;

create policy "inversiones: select propias" on public.inversiones
  for select using (auth.uid() = usuario_id);
create policy "inversiones: insert propias" on public.inversiones
  for insert with check (auth.uid() = usuario_id);
create policy "inversiones: update propias" on public.inversiones
  for update using (auth.uid() = usuario_id);
create policy "inversiones: delete propias" on public.inversiones
  for delete using (auth.uid() = usuario_id);

-- ============ DEUDA / PRÉSTAMOS (modelo genérico) ============
create table if not exists public.deudas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null,
  nombre text not null,
  capital_inicial numeric(14, 2) not null,
  capital_pendiente numeric(14, 2) not null,
  cuota numeric(14, 2) not null,
  periodicidad text not null default 'mensual',
  tipo_interes numeric(6, 3),
  modalidad_interes text default 'fijo' check (modalidad_interes in ('fijo', 'variable', 'mixto')),
  fecha_inicio date not null,
  fecha_fin date,
  valor_residual numeric(14, 2),
  moneda text not null default 'EUR',
  created_at timestamptz not null default now()
);

alter table public.deudas enable row level security;

create policy "deudas: select propias" on public.deudas
  for select using (auth.uid() = usuario_id);
create policy "deudas: insert propias" on public.deudas
  for insert with check (auth.uid() = usuario_id);
create policy "deudas: update propias" on public.deudas
  for update using (auth.uid() = usuario_id);
create policy "deudas: delete propias" on public.deudas
  for delete using (auth.uid() = usuario_id);

-- ============ AMORTIZACIONES EXTRA (calculadora) ============
create table if not exists public.amortizaciones_extra (
  id uuid primary key default gen_random_uuid(),
  deuda_id uuid not null references public.deudas(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  fecha date not null,
  importe numeric(14, 2) not null,
  tipo_reduccion text not null check (tipo_reduccion in ('reducir_cuota', 'reducir_plazo')),
  recurrencia text not null default 'puntual' check (recurrencia in ('puntual', 'mensual', 'anual')),
  created_at timestamptz not null default now()
);

alter table public.amortizaciones_extra enable row level security;

create policy "amortizaciones: select propias" on public.amortizaciones_extra
  for select using (auth.uid() = usuario_id);
create policy "amortizaciones: insert propias" on public.amortizaciones_extra
  for insert with check (auth.uid() = usuario_id);
create policy "amortizaciones: update propias" on public.amortizaciones_extra
  for update using (auth.uid() = usuario_id);
create policy "amortizaciones: delete propias" on public.amortizaciones_extra
  for delete using (auth.uid() = usuario_id);

-- ============ OBJETIVO DE AHORRO ============
create table if not exists public.objetivos_ahorro (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  periodo date not null, -- primer día del mes al que aplica el objetivo
  importe_objetivo numeric(14, 2) not null,
  created_at timestamptz not null default now(),
  unique (usuario_id, periodo)
);

alter table public.objetivos_ahorro enable row level security;

create policy "objetivos: select propios" on public.objetivos_ahorro
  for select using (auth.uid() = usuario_id);
create policy "objetivos: insert propios" on public.objetivos_ahorro
  for insert with check (auth.uid() = usuario_id);
create policy "objetivos: update propios" on public.objetivos_ahorro
  for update using (auth.uid() = usuario_id);
create policy "objetivos: delete propios" on public.objetivos_ahorro
  for delete using (auth.uid() = usuario_id);

-- Nota: "importe_real" y "cumplido" del objetivo de ahorro se calculan en la
-- aplicación a partir de los movimientos del periodo (no se almacenan), para
-- que siempre reflejen el estado real de las cuentas.
