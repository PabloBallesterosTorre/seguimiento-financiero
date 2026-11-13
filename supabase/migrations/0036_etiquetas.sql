-- Tanda 15: etiquetas en movimientos.
--
-- La categoría dice QUÉ es un gasto (restaurante, gasolina, hotel); la etiqueta dice PARA
-- QUÉ o DE QUÉ fue (el viaje a Japón, la reforma del baño, el coche). Un mismo movimiento
-- tiene una sola categoría pero puede llevar varias etiquetas, y una etiqueta junta gastos
-- de categorías distintas. Por eso va en tabla aparte con una de unión, y no como otra
-- columna de `movimientos`.
--
-- La regla es opcional y explícita: "si el concepto contiene X, ponle esta etiqueta". No se
-- aprende sola como las de categoría (reglas_categorizacion), porque una etiqueta suele ser
-- temporal —un viaje dura dos semanas— y aprender "Mercadona → Viaje a Japón" de un solo
-- caso etiquetaría mal todas las compras siguientes.

create table if not exists public.etiquetas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  nombre text not null check (length(trim(nombre)) > 0),
  -- Texto que, si aparece en el concepto (sin distinguir mayúsculas ni acentos), pone la
  -- etiqueta sola al importar o al crear un movimiento. Null: solo se pone a mano.
  patron text,
  created_at timestamptz not null default now()
);

create unique index if not exists etiquetas_usuario_nombre_idx
  on public.etiquetas (usuario_id, lower(nombre));

alter table public.etiquetas enable row level security;

create policy "etiquetas: select propias" on public.etiquetas
  for select using (auth.uid() = usuario_id);
create policy "etiquetas: insert propias" on public.etiquetas
  for insert with check (auth.uid() = usuario_id);
create policy "etiquetas: update propias" on public.etiquetas
  for update using (auth.uid() = usuario_id);
create policy "etiquetas: delete propias" on public.etiquetas
  for delete using (auth.uid() = usuario_id);

create table if not exists public.movimiento_etiquetas (
  movimiento_id uuid not null references public.movimientos(id) on delete cascade,
  etiqueta_id uuid not null references public.etiquetas(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  -- 'manual': puesta por el usuario. 'regla': puesta por el patrón de la etiqueta. Se
  -- distingue para que quitar o cambiar el patrón pueda deshacer solo lo que puso él.
  origen text not null default 'manual' check (origen in ('manual', 'regla')),
  created_at timestamptz not null default now(),
  primary key (movimiento_id, etiqueta_id)
);

create index if not exists movimiento_etiquetas_etiqueta_idx on public.movimiento_etiquetas (etiqueta_id);

alter table public.movimiento_etiquetas enable row level security;

-- La fila es del usuario, pero además el movimiento y la etiqueta tienen que ser suyos: sin
-- esa comprobación, alguien podría colgar su etiqueta de un movimiento ajeno si conociera
-- su id.
create policy "movimiento_etiquetas: select propias" on public.movimiento_etiquetas
  for select using (auth.uid() = usuario_id);
create policy "movimiento_etiquetas: insert propias" on public.movimiento_etiquetas
  for insert with check (
    auth.uid() = usuario_id
    and exists (select 1 from public.movimientos m where m.id = movimiento_id and m.usuario_id = auth.uid())
    and exists (select 1 from public.etiquetas e where e.id = etiqueta_id and e.usuario_id = auth.uid())
  );
create policy "movimiento_etiquetas: delete propias" on public.movimiento_etiquetas
  for delete using (auth.uid() = usuario_id);
