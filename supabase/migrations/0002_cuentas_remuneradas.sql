-- Cuentas remuneradas: cada cuenta puede marcarse como remunerada con su propio
-- tipo de interés y periodicidad de pago. Solo captura de datos por ahora — el
-- cálculo de intereses devengados queda para un incremento futuro.
alter table public.cuentas
  add column es_remunerada boolean not null default false,
  add column tipo_interes numeric(6, 3),
  add column periodicidad_pago_interes text
    check (periodicidad_pago_interes in ('diaria', 'semanal', 'mensual', 'trimestral', 'anual'));
