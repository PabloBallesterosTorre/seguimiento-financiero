-- Nivel 2 de previsión automática (media histórica por categoría, tanda 4 punto 4):
-- a diferencia de un previsto "fijo" (manual, cuota de deuda, o un patrón nivel 1 con
-- importe estable), un previsto de origen 'media_categoria' no debe congelar el
-- importe al aceptarlo — su importe se recalcula en cada proyección a partir del
-- histórico actual de esa categoría, para que se actualice solo según llega más
-- histórico (tal como pedía el punto 8 de la tanda 1).
alter table public.movimientos_previstos
  add column origen_calculo text not null default 'fijo' check (origen_calculo in ('fijo', 'media_categoria'));
