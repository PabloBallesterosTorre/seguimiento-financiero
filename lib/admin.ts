// Quién puede crear invitaciones.
//
// Se resuelve con una variable de entorno (`ADMIN_EMAILS`) y no con una columna en la
// base de datos a propósito: una columna `es_admin` la puede escribir cualquiera que
// llegue a la tabla, y aquí el privilegio que se concede es "dar de alta a gente nueva
// en la app". Con una env var, el permiso vive donde viven las claves —fuera del
// alcance de cualquier usuario— y cambiarlo exige acceso al despliegue.
//
// Sin la variable puesta, nadie es administrador. Falla cerrado: preferimos que a quien
// la configuración le falte no le aparezca la pantalla, a que un despiste abra el alta.

export function parseAdminEmails(valor: string | undefined | null): string[] {
  if (!valor) return [];
  return valor
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
}

export function esAdmin(email: string | null | undefined, admins: string[]): boolean {
  if (!email) return false;
  if (admins.length === 0) return false;
  return admins.includes(email.trim().toLowerCase());
}

// Atajo para el servidor, que siempre lee de la misma variable.
export function esAdminActual(email: string | null | undefined): boolean {
  return esAdmin(email, parseAdminEmails(process.env.ADMIN_EMAILS));
}
