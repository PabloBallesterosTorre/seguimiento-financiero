-- Regla 50/30/20: a qué bloque pertenece cada categoría.
--
-- El gráfico de la regla reparte lo que entra en el mes entre Necesario, Caprichos y
-- Ahorro. Para eso cada categoría tiene que decir en cuál cae, y no se puede deducir del
-- nombre: "Alimentación" es necesario y "Restaurantes" es capricho aunque las dos sean
-- comida, y la misma categoría puede ser una cosa para un usuario y otra para otro.
--
-- Solo tres valores. El Ahorro no se marca: es lo que queda de los ingresos después de
-- lo necesario y los caprichos, y las categorías de inversión (es_categoria_inversion)
-- cuentan dentro de él sin que haga falta marcarlas. Sin valor, una subcategoría hereda
-- el bloque de su padre; si tampoco lo tiene, sus movimientos salen como "sin clasificar"
-- en vez de desaparecer del reparto.

alter table public.categorias
  add column if not exists bloque text
  check (bloque in ('ingreso', 'necesario', 'capricho'));

comment on column public.categorias.bloque is
  'Bloque de la regla 50/30/20: ingreso, necesario o capricho. Null: hereda del padre o queda sin clasificar. Las categorías de inversión cuentan como ahorro.';
