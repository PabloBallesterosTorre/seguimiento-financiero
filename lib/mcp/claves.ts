import { createHash, randomBytes } from "node:crypto";

// Tanda 17: claves personales para el servidor MCP.
//
// "sf_" + 40 caracteres alfanuméricos (~238 bits de azar): imposible de adivinar, así que
// no hace falta limitar intentos. Se guarda solo el SHA-256; un hash lento (bcrypt) no
// aporta nada con tanta entropía y obligaría a recorrer todas las claves en cada petición.

const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const LONGITUD = 40;

export function generarClave(): string {
  let clave = "";
  // Se descartan los bytes >= 248 (62 × 4) para que todos los caracteres salgan con la
  // misma probabilidad; con un simple módulo, los primeros del alfabeto saldrían más.
  while (clave.length < LONGITUD) {
    for (const b of randomBytes(LONGITUD)) {
      if (b < 248 && clave.length < LONGITUD) clave += ALFABETO[b % 62];
    }
  }
  return `sf_${clave}`;
}

export function hashClave(clave: string): string {
  return createHash("sha256").update(clave, "utf8").digest("hex");
}

// Lo que se enseña en la lista para reconocer una clave sin poder usarla.
export function prefijoClave(clave: string): string {
  return clave.slice(0, 9);
}

// La clave del encabezado "Authorization: Bearer <clave>". Null si no viene o no tiene la
// forma de una clave de esta app (así ni se consulta la base de datos).
export function claveDeCabecera(cabecera: string | null): string | null {
  const m = cabecera?.match(/^Bearer\s+(sf_[A-Za-z0-9]{40})\s*$/);
  return m ? m[1] : null;
}
