-- Tanda 12: el mes financiero — el mes va de nómina a nómina, no del 1 al 31.
--
-- La nómina con la que se vive septiembre se cobra el 28 de agosto. Contando por mes
-- natural, septiembre se queda sin sueldo y agosto tiene dos. En el histórico real esto
-- no es un matiz: julio pasaba de −2.131,73 € a +799,78 € y septiembre de −305,77 € a
-- +744,35 € solo por mover la frontera. La app respondía "no has ahorrado" a meses en los
-- que sí se había ahorrado.
--
-- El día de cobro no es fijo (28, 29, 30, y el banco adelanta si cae en fin de semana),
-- así que la frontera no puede ser un día fijo: se ancla en la propia nómina. Ver
-- lib/mesFinanciero.ts para las reglas exactas, incluida la ventana que deja fuera la
-- paga extra de mediados de mes.

alter table public.configuracion_usuario
  -- Por defecto desactivado: nadie debe encontrarse los meses movidos sin haberlo pedido.
  add column if not exists mes_financiero boolean not null default false,
  -- Respaldo para los meses sin nómina que anclar (el mes en curso hasta que llega, o un
  -- periodo sin nómina). Tope en 28 para que exista en todos los meses, febrero incluido.
  add column if not exists dia_corte_mes smallint not null default 25
    check (dia_corte_mes between 1 and 28),
  -- Categoría cuyos ingresos marcan el inicio del mes. Sin ella solo queda el respaldo.
  -- `on delete set null` y no cascade: borrar una categoría no debe borrar la preferencia
  -- entera, solo dejar de anclar.
  add column if not exists categoria_inicio_mes uuid
    references public.categorias(id) on delete set null;

comment on column public.configuracion_usuario.mes_financiero is
  'Si los meses se cuentan de nómina a nómina (true) o del 1 al 31 (false).';
comment on column public.configuracion_usuario.dia_corte_mes is
  'Día de respaldo para empezar el mes cuando no hay ninguna nómina que anclar.';
comment on column public.configuracion_usuario.categoria_inicio_mes is
  'Categoría cuyos ingresos marcan la frontera entre un mes financiero y el siguiente.';
