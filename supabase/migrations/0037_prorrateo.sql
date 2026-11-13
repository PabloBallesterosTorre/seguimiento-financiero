-- Tanda 16: prorrateo de un movimiento entre varios meses.
--
-- Solo cambia cómo se reparte el gasto (o el ingreso) en los informes por mes: un seguro
-- anual pagado en enero cuenta una doceava parte en cada mes. El saldo y el movimiento no
-- cambian; el reparto se calcula al leer (lib/prorrateo.ts), no se guardan partes.
-- Null o 1: sin prorratear. El tope de 36 meses evita que un error de tecleo reparta un
-- gasto en décadas.

alter table public.movimientos
  add column if not exists prorrateo_meses smallint
    check (prorrateo_meses is null or prorrateo_meses between 2 and 36);

comment on column public.movimientos.prorrateo_meses is
  'Meses en los que se reparte el movimiento en los informes, desde el suyo. Null: sin prorratear.';
