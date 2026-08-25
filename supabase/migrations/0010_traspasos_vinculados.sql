-- Vincular como traspaso dos movimientos que ya existían (uno por cuenta, cada uno
-- importado o creado de forma independiente) es distinto de crear un traspaso nuevo:
-- ambas filas ya estaban sumadas a sus saldos respectivos, así que vincularlas no debe
-- tocar ningún saldo. tipo_original guarda el tipo previo (ingreso/gasto) para poder
-- desvincularlas después sin tocar saldos tampoco — a diferencia de un traspaso creado
-- de cero, donde eliminarlo sí revierte el saldo porque las filas no existían antes.
alter table public.movimientos
  add column tipo_original text check (tipo_original in ('ingreso', 'gasto'));
