-- Preferencia del selector de cuentas de informes/planificador/prevision/home (tanda
-- filtro por cuenta): se guarda la lista de cuentas EXCLUIDAS, no las incluidas, para
-- que una cuenta nueva aparezca seleccionada por defecto aunque el usuario ya hubiera
-- personalizado su selección antes de crearla. La URL (?cuentas=id1,id2) manda sobre
-- esta preferencia cuando está presente; esta solo se usa sin parámetro en la URL.
alter table public.configuracion_usuario
  add column if not exists cuentas_excluidas_informes uuid[] not null default '{}';
