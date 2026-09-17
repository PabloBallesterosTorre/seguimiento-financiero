-- Tanda 12: separar "de quién es el dinero" de "qué tipo de cuenta es".
--
-- `cuentas.tipo` venía mezclando dos ejes que no tienen nada que ver:
--
--   corriente / ahorro  -> la naturaleza de la cuenta
--   conjunta            -> de quién es el dinero
--
-- El síntoma se ve en los datos reales: la cuenta "Ahorro Conjunto" es de ahorro Y es
-- compartida, pero había que elegir uno de los dos, así que quedó marcada como 'conjunta'
-- y se perdió que era de ahorro. Y al revés: no había forma de decir que una cuenta
-- corriente es compartida sin renunciar a que sea corriente.
--
-- Con `ambito` aparte, los informes pueden separar lo personal de lo conjunto —que es la
-- pregunta que atraviesa toda la pantalla de Informes— sin depender de un campo que
-- significa otra cosa.
--
-- `tipo` conserva 'conjunta' entre sus valores válidos a propósito: las cuentas existentes
-- lo siguen teniendo y no se fuerza una reclasificación automática, porque desde 'conjunta'
-- no hay manera de adivinar si era corriente o de ahorro. Cada cuenta se reclasifica a mano
-- desde el formulario, que ya no ofrece 'conjunta' como tipo.

alter table public.cuentas
  add column if not exists ambito text not null default 'personal'
    check (ambito in ('personal', 'conjunto'));

-- Lo que hasta ahora se marcaba como tipo 'conjunta' es, por definición, ámbito conjunto.
update public.cuentas
set ambito = 'conjunto'
where tipo = 'conjunta' and ambito = 'personal';

comment on column public.cuentas.ambito is
  'De quién es el dinero: personal o compartido. Separado de `tipo`, que describe la naturaleza de la cuenta (corriente/ahorro). Los informes filtran por este campo.';
