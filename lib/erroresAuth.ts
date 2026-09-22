// Traducción de los errores de Supabase Auth a mensajes propios en español.
//
// Antes se enviaba a la interfaz el `error.message` de la librería tal cual, así que al
// fallar el acceso se leía "Invalid login credentials" en una app que está entera en
// español (auditoría de diseño, tanda 11). El problema de fondo no era ese mensaje
// concreto: era que CUALQUIER error de Auth acababa en pantalla con su texto original,
// incluidos los que hablan de detalles internos que no le dicen nada al usuario.
//
// Por eso la función tiene un caso por defecto genérico en vez de devolver el original:
// lo que no esté traducido sale como un mensaje neutro, y el texto real se queda en el
// servidor.

const TRADUCCIONES: { patron: RegExp; mensaje: string }[] = [
  { patron: /invalid login credentials/i, mensaje: "Email o contraseña incorrectos." },
  { patron: /email not confirmed/i, mensaje: "Tu email todavía no está confirmado. Revisa tu correo." },
  {
    patron: /invalid or has expired|token has expired|otp_expired/i,
    mensaje: "El enlace ha caducado o ya se ha usado. Pide uno nuevo.",
  },
  {
    patron: /password should be at least|weak.?password/i,
    mensaje: "La contraseña es demasiado corta: usa al menos 6 caracteres.",
  },
  {
    patron: /same.?password|should be different from the old/i,
    mensaje: "La contraseña nueva tiene que ser distinta de la anterior.",
  },
  {
    patron: /rate limit|too many requests|over_email_send_rate_limit/i,
    mensaje: "Demasiados intentos seguidos. Espera un minuto y vuelve a probar.",
  },
  { patron: /user not found/i, mensaje: "No hay ninguna cuenta con ese email." },
  {
    patron: /already registered|already been registered|email_exists|user already exists/i,
    mensaje: "Ya existe una cuenta con ese email. Entra con tu contraseña o recupérala desde el acceso.",
  },
  { patron: /signups? not allowed|signup_disabled/i, mensaje: "El alta de usuarios está cerrada." },
  { patron: /network|fetch failed/i, mensaje: "No se ha podido conectar. Comprueba tu conexión." },
];

const GENERICO = "No se ha podido completar la operación. Inténtalo de nuevo.";

export function traducirErrorAuth(mensajeOriginal: string | null | undefined): string {
  if (!mensajeOriginal) return GENERICO;
  const encontrado = TRADUCCIONES.find((t) => t.patron.test(mensajeOriginal));
  return encontrado ? encontrado.mensaje : GENERICO;
}
