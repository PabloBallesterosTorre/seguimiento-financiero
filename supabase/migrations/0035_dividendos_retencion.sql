-- Tanda 14: cartera de inversión completa — dividendos con retención.
--
-- Un dividendo ya se podía registrar (tipo 'dividendo' en inversion_operaciones), pero
-- solo con el importe que llega a la cuenta. Ese importe es el NETO: Hacienda (o el país
-- de origen) ya se ha quedado su parte. Para saber la rentabilidad por dividendo real de
-- una posición y lo que se ha retenido en el año —que luego cuenta en la renta— hace
-- falta guardar también la retención.
--
-- Se guarda en positivo, como importe retenido. `importe` sigue siendo el neto cobrado
-- (con el signo de siempre: negativo, porque sale de la inversión), así que nada de lo
-- que ya calcula con `importe` cambia: el bruto es simplemente |importe| + retencion.
-- En cualquier otro tipo de operación la retención es 0 y no significa nada.

alter table public.inversion_operaciones
  add column if not exists retencion numeric(14, 2) not null default 0
    check (retencion >= 0);

comment on column public.inversion_operaciones.retencion is
  'Solo dividendos: importe retenido en origen, en positivo. Bruto = |importe| + retencion.';
