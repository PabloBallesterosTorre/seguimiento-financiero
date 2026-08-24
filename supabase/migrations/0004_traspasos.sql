-- Traspasos entre cuentas propias: no son ni ingreso ni gasto. Se modelan como dos
-- filas de movimientos (una por cuenta) enlazadas por traspaso_grupo_id, cada una
-- con el signo correcto para su cuenta — así el listado ya muestra negativo en el
-- origen y positivo en el destino sin lógica especial de renderizado.
alter table public.movimientos
  drop constraint movimientos_tipo_check,
  add constraint movimientos_tipo_check check (tipo in ('ingreso', 'gasto', 'traspaso')),
  add column traspaso_grupo_id uuid;

create index if not exists movimientos_traspaso_grupo_id_idx on public.movimientos (traspaso_grupo_id);
