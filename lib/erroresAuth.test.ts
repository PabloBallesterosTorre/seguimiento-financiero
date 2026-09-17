import { describe, expect, it } from "vitest";
import { traducirErrorAuth } from "./erroresAuth";

describe("traducirErrorAuth", () => {
  it("traduce el error de credenciales, que es el que más se ve", () => {
    expect(traducirErrorAuth("Invalid login credentials")).toBe("Email o contraseña incorrectos.");
  });

  it("no distingue mayúsculas ni exige el texto exacto", () => {
    expect(traducirErrorAuth("AuthApiError: invalid login credentials")).toBe("Email o contraseña incorrectos.");
  });

  it("traduce enlaces caducados y contraseñas débiles", () => {
    expect(traducirErrorAuth("Email link is invalid or has expired")).toContain("caducado");
    expect(traducirErrorAuth("Password should be at least 6 characters")).toContain("6 caracteres");
  });

  it("un error desconocido no se filtra a la interfaz", () => {
    const traducido = traducirErrorAuth("pgrst: relation auth.foo does not exist");
    expect(traducido).not.toContain("pgrst");
    expect(traducido).not.toContain("auth.foo");
    expect(traducido).toContain("Inténtalo de nuevo");
  });

  it("sin mensaje devuelve el genérico", () => {
    expect(traducirErrorAuth(null)).toContain("Inténtalo de nuevo");
    expect(traducirErrorAuth("")).toContain("Inténtalo de nuevo");
  });
});
