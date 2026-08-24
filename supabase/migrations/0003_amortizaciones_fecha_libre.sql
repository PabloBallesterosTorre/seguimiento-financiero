-- Amortizaciones extra con fecha libre por aportación: cada fila es siempre una
-- fecha y un importe concretos (no una regla de recurrencia abstracta). `aplicado`
-- distingue un pago ya realizado (afecta a capital_pendiente/cuota) de un plan
-- futuro que todavía no se ha confirmado.
alter table public.amortizaciones_extra
  add column aplicado boolean not null default false,
  add column aplicado_en timestamptz;

-- Las amortizaciones ya existentes (creadas por el flujo "Aplicar" anterior) se
-- consideran aplicadas.
update public.amortizaciones_extra set aplicado = true, aplicado_en = created_at;
