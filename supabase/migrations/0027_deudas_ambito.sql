-- Tanda 12: la deuda también tiene ámbito.
--
-- Al separar los informes entre personal y conjunto apareció el mismo problema que con las
-- cuentas, pero en la deuda: la vista de "Conjunto" pintaba los 148.203 € de la hipoteca
-- —que está a nombre de una sola persona— como si fuera deuda compartida. El patrimonio
-- neto del ámbito conjunto salía con 150.000 € de deuda que no le corresponden.
--
-- Por defecto 'personal', que es lo correcto para una deuda a nombre propio: una hipoteca o
-- un préstamo de coche solo son conjuntos si los dos figuran como titulares, y eso es la
-- excepción, no la norma.

alter table public.deudas
  add column if not exists ambito text not null default 'personal'
    check (ambito in ('personal', 'conjunto'));

comment on column public.deudas.ambito is
  'De quién es la deuda: personal o compartida. Los informes filtran por este campo, igual que con cuentas.ambito.';
