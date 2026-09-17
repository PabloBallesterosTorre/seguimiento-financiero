-- Tanda 12: categorizar las nóminas que estaban sueltas.
--
-- Al montar el mes financiero salió que de las cinco nóminas del histórico solo dos
-- tenían categoría. Las otras tres caían en "Sin categorizar", así que el bloque "de
-- dónde viene mi dinero" no enseñaba el sueldo como fuente de ingresos — que es la
-- respuesta más obvia a esa pregunta. Además, sin categoría no pueden anclar el mes.
--
-- El criterio es estrecho a propósito: solo movimientos de ingreso cuya descripción sea
-- exactamente "NOMINA" (así los deja el extracto del banco) y que no tengan ya una
-- categoría puesta a mano. No se toca nada que el usuario haya categorizado.

update public.movimientos m
set categoria_id = c.id
from public.categorias c
where c.usuario_id = m.usuario_id
  and lower(c.nombre) = 'nómina'
  and m.categoria_id is null
  and m.importe > 0
  and upper(trim(m.descripcion)) = 'NOMINA';

-- Deja el mes financiero listo para quien ya tenga esa categoría: se activa con la
-- nómina como ancla y el día 25 de respaldo. Una instalación nueva sigue arrancando en
-- mes natural, porque no hay fila de configuración que actualizar.
update public.configuracion_usuario cu
set mes_financiero = true,
    categoria_inicio_mes = c.id
from public.categorias c
where c.usuario_id = cu.usuario_id
  and lower(c.nombre) = 'nómina'
  and cu.categoria_inicio_mes is null;
