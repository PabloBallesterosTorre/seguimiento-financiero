-- Tanda 12: previstos fijos y previstos de presupuesto.
--
-- Los previstos no son todos la misma cosa. Unos son una TRANSACCIÓN ESPERADA de importe
-- conocido —la cuota de la hipoteca, el seguro médico, la comunidad, la aportación
-- periódica a inversión—: se cumplen tal cual y, cuando llega el movimiento real, se
-- concilian y dejan de contar.
--
-- Otros son un PRESUPUESTO de categoría: "cuento con gastarme 400 € en ocio". Ahí el
-- importe no predice una transacción, sino un techo para el mes. En cuanto el mes en curso
-- tiene gasto real en esa categoría, el presupuesto deja de aportar nada y el mes vale lo
-- que de verdad se ha gastado. Para los meses futuros, que todavía no tienen gasto real,
-- se sigue usando el presupuesto.
--
-- Sin esta distinción el mes en curso contaba las dos cosas: el gasto real ya estaba
-- descontado del saldo y encima se le sumaba el previsto entero.
--
-- No se reutiliza `origen_calculo` ('fijo' | 'media_categoria') a propósito: ese campo dice
-- de dónde sale el IMPORTE, y este dice cómo se COMPORTA el previsto dentro del mes. Son
-- dos ejes distintos y mezclarlos es el mismo error que ya se cometió con `cuentas.tipo`.

alter table public.movimientos_previstos
  add column if not exists es_presupuesto boolean not null default false;

comment on column public.movimientos_previstos.es_presupuesto is
  'false: transaccion esperada, se concilia al ocurrir. true: presupuesto de categoria, el mes en curso pasa a valer el gasto real en cuanto lo hay.';
