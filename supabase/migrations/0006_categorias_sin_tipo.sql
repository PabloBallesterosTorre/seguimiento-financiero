-- Las categorías dejan de estar ligadas a ingreso/gasto: una misma categoría
-- (ej. "Restaurantes") puede usarse tanto en un gasto (pagar la cena) como en un
-- ingreso (que un amigo te devuelva su parte). El signo del importe en el
-- movimiento ya determina si es ingreso o gasto — no hace falta duplicarlo en la
-- categoría.
alter table public.categorias
  drop constraint categorias_tipo_check,
  drop column tipo;
