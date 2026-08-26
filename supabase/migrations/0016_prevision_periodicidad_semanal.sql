-- Añade la periodicidad semanal a los movimientos previstos recurrentes. A diferencia
-- del resto (una vez cada N meses), semanal puede dar varias ocurrencias en el mismo
-- mes; el importe introducido se entiende como el de una semana (lib/prevision.ts,
-- ocurrenciasEnMes se encarga de multiplicarlo).
alter table public.movimientos_previstos
  drop constraint movimientos_previstos_periodicidad_check,
  add constraint movimientos_previstos_periodicidad_check
    check (periodicidad in ('semanal', 'mensual', 'bimensual', 'trimestral', 'semestral', 'anual'));
