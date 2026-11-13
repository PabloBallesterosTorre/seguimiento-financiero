import { describe, expect, it } from "vitest";
import { claveDeCabecera, generarClave, hashClave, prefijoClave } from "./claves";

describe("claves MCP", () => {
  it("genera claves con prefijo sf_ y 40 caracteres alfanuméricos, distintas cada vez", () => {
    const a = generarClave();
    const b = generarClave();
    expect(a).toMatch(/^sf_[A-Za-z0-9]{40}$/);
    expect(a).not.toBe(b);
    expect(prefijoClave(a)).toBe(a.slice(0, 9));
  });

  it("el hash es el SHA-256 en hexadecimal, el mismo que calcula Postgres", () => {
    // encode(digest('sf_test_lectura_123','sha256'),'hex') en la base de datos.
    expect(hashClave("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("solo acepta cabeceras Bearer con una clave bien formada", () => {
    const clave = generarClave();
    expect(claveDeCabecera(`Bearer ${clave}`)).toBe(clave);
    expect(claveDeCabecera(null)).toBeNull();
    expect(claveDeCabecera(clave)).toBeNull();
    expect(claveDeCabecera("Bearer sf_corta")).toBeNull();
    expect(claveDeCabecera(`Bearer ${clave}' or 1=1`)).toBeNull();
  });
});
