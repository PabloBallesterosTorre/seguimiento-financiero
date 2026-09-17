-- El saldo de una cuenta se venía manteniendo solo de forma incremental: cada alta,
-- importación o borrado sumaba o restaba sobre `saldo_actual`. Eso lo hace imposible
-- de verificar (no hay contra qué contrastarlo) y, en cuanto una operación falla a
-- medias o alguien teclea el saldo a mano, queda desacoplado de sus movimientos para
-- siempre y sin forma de detectarlo. Pasó de verdad: la cuenta de Trade Republic
-- acabó con 123,33 € de desfase respecto a la suma de sus propios movimientos.
--
-- `saldo_inicial` cierra ese hueco: guarda el saldo de la cuenta ANTES del primer
-- movimiento registrado, de forma que el saldo pasa a ser verificable en todo momento
--
--     saldo esperado = saldo_inicial + suma(movimientos)
--
-- `saldo_actual` se mantiene como hasta ahora (es lo que leen el resto de pantallas y
-- evita recalcular la suma en cada consulta), pero ahora se puede comprobar y reparar.
alter table public.cuentas
  add column if not exists saldo_inicial numeric(14, 2) not null default 0;

-- Backfill: se deriva el saldo inicial de cada cuenta existente restando sus
-- movimientos al saldo guardado hoy. Así ninguna cuenta cambia de saldo al aplicar
-- esta migración — el estado actual se conserva exactamente y, a partir de aquí,
-- cualquier desfase nuevo es detectable.
--
-- Nota: para una cuenta cuyo histórico arranca en su apertura real (Trade Republic —
-- Personal, con el extracto completo desde el primer ingreso) el resultado correcto es
-- 0. Para las que solo tienen histórico parcial (Revolut, Ibercaja, importadas desde
-- una fecha concreta) el resultado es el saldo que tenían en esa fecha de corte, que
-- es justo lo que representa este campo.
update public.cuentas c
set saldo_inicial = c.saldo_actual - coalesce(
  (select sum(m.importe) from public.movimientos m where m.cuenta_id = c.id),
  0
);
