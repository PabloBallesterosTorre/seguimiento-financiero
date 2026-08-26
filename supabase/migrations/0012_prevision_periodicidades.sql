-- Amplía las periodicidades de un movimiento previsto recurrente más allá de
-- mensual/anual (tanda 5, mejora 3): bimensual, trimestral y semestral, para
-- seguros/suscripciones con pago no mensual ni anual.
alter table public.movimientos_previstos
  drop constraint movimientos_previstos_periodicidad_check,
  add constraint movimientos_previstos_periodicidad_check
    check (periodicidad in ('mensual', 'bimensual', 'trimestral', 'semestral', 'anual'));
