-- IBAN opcional por cuenta: sirve para reconocer más adelante, al importar un CSV,
-- cuándo el "counterparty_iban" de un movimiento corresponde a otra cuenta propia
-- (traspaso entre bancos), en vez de un ingreso o gasto real.
alter table public.cuentas
  add column iban text;
