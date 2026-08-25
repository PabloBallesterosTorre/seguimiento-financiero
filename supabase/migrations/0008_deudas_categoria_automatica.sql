-- Cada deuda enlaza con su propia categoría de gasto ("Pago " + nombre), creada
-- automáticamente al dar de alta la deuda, para poder categorizar sus cuotas sin
-- crear la categoría a mano. Si se borra la categoría, la deuda no se borra (set null).
alter table public.deudas
  add column categoria_id uuid references public.categorias(id) on delete set null;
