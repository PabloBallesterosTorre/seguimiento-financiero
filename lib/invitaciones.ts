// Lógica pura del registro por invitación: generar el código, normalizar lo que teclea
// el usuario y decidir si una invitación se puede canjear. Sin Supabase de por medio,
// para poder probarla sin base de datos.

export type Invitacion = {
  id: string;
  codigo: string;
  email: string;
  nota: string | null;
  creada_en: string;
  caduca_en: string;
  reservada_en: string | null;
  usada_por: string | null;
  usada_en: string | null;
};

// Sin I, L, O, 0 ni 1: son los caracteres que se confunden al copiar un código a mano
// desde una pantalla o una captura. Perder cinco símbolos del alfabeto cuesta medio bit
// por carácter; una llamada de "¿esto es un uno o una ele?" cuesta más.
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const LONGITUD_CODIGO = 12;

// Código de invitación aleatorio, en tres grupos de cuatro ("A7K2-MQ4X-9BHP").
//
// Con `crypto.getRandomValues`, no `Math.random`: un código de invitación es la única
// puerta de entrada a la app, y `Math.random` no es criptográficamente seguro — su
// secuencia es predecible si se observan suficientes valores. 12 caracteres sobre un
// alfabeto de 31 son unos 59 bits, de sobra para que adivinar uno por fuerza bruta a
// través de HTTP no sea una vía realista.
export function generarCodigo(): string {
  const valores = new Uint32Array(LONGITUD_CODIGO);
  crypto.getRandomValues(valores);

  // El módulo sesga levemente hacia los primeros símbolos del alfabeto (2^32 no es
  // múltiplo de 31). El sesgo es del orden de 1 entre 10^8 y no reduce la entropía de
  // forma apreciable, así que no compensa el rechazo-y-reintento.
  const letras = Array.from(valores, (v) => ALFABETO[v % ALFABETO.length]);

  return [letras.slice(0, 4), letras.slice(4, 8), letras.slice(8, 12)]
    .map((grupo) => grupo.join(""))
    .join("-");
}

// Deja el código como lo guarda la base de datos, venga pegado del enlace, tecleado sin
// guiones o con espacios de más. Lo que no es letra ni dígito se descarta (incluidos los
// guiones, que se vuelven a poner al agrupar).
export function normalizarCodigo(valor: string): string {
  const limpio = valor.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (limpio.length !== LONGITUD_CODIGO) return limpio;
  return `${limpio.slice(0, 4)}-${limpio.slice(4, 8)}-${limpio.slice(8, 12)}`;
}

export function normalizarEmail(valor: string): string {
  return valor.trim().toLowerCase();
}

export type EstadoInvitacion = "pendiente" | "usada" | "caducada";

export function estadoInvitacion(inv: Invitacion, ahora: Date): EstadoInvitacion {
  if (inv.usada_en) return "usada";
  if (new Date(inv.caduca_en).getTime() <= ahora.getTime()) return "caducada";
  return "pendiente";
}

// Cuánto tiempo puede estar una invitación reservada antes de considerarla libre otra
// vez. Cubre el hueco entre reservarla y crear el usuario: si el servidor se cae por el
// medio, el código se recupera solo en vez de quedar quemado. Diez minutos son de sobra
// para un alta que tarda un segundo, y lo bastante poco para que nadie se quede
// esperando si le pasa.
export const MINUTOS_RESERVA = 10;

export function reservaCaducada(reservadaEn: string | null, ahora: Date): boolean {
  if (!reservadaEn) return true;
  return ahora.getTime() - new Date(reservadaEn).getTime() > MINUTOS_RESERVA * 60_000;
}

// Por qué NO se puede canjear esta invitación, o null si sí se puede.
//
// Los mensajes distinguen el motivo a propósito (caducada, ya usada, email que no
// corresponde): quien llega aquí tiene una invitación de verdad en la mano, y decirle
// "no es válida" a secas le deja sin saber si el problema lo arregla él o tiene que
// pedir otra. La enumeración de códigos no es un riesgo real con 59 bits de entropía.
export function motivoRechazo(
  inv: Invitacion | null,
  emailIntroducido: string,
  ahora: Date
): string | null {
  if (!inv) return "Esta invitación no existe. Comprueba el código o pide una nueva.";

  const estado = estadoInvitacion(inv, ahora);
  if (estado === "usada") return "Esta invitación ya se ha usado. Si eras tú, entra con tu contraseña.";
  if (estado === "caducada") return "Esta invitación ha caducado. Pide una nueva a quien te la envió.";

  if (normalizarEmail(emailIntroducido) !== normalizarEmail(inv.email)) {
    return "Esta invitación es para otro email. Usa el email al que te la enviaron.";
  }

  if (!reservaCaducada(inv.reservada_en, ahora)) {
    return "Se está completando un alta con esta invitación ahora mismo. Espera un momento y vuelve a intentarlo.";
  }

  return null;
}

// Validación de la contraseña elegida en el alta. Supabase rechaza menos de 6
// caracteres, pero el mensaje llega en inglés y solo después de haber reservado la
// invitación: comprobarlo antes evita gastar el intento y explica el problema en el
// idioma de la app.
export function validarPassword(password: string, repetida: string): string | null {
  if (password.length < 6) return "La contraseña tiene que tener al menos 6 caracteres.";
  if (password !== repetida) return "Las dos contraseñas no coinciden.";
  return null;
}

export function enlaceInvitacion(origen: string, codigo: string): string {
  return `${origen.replace(/\/$/, "")}/registro?codigo=${encodeURIComponent(codigo)}`;
}
