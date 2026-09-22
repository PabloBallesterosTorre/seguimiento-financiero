import { describe, expect, it } from "vitest";
import {
  enlaceInvitacion,
  estadoInvitacion,
  generarCodigo,
  motivoRechazo,
  normalizarCodigo,
  normalizarEmail,
  reservaCaducada,
  validarPassword,
  type Invitacion,
} from "./invitaciones";

const AHORA = new Date("2026-09-22T12:00:00Z");

function invitacion(cambios: Partial<Invitacion> = {}): Invitacion {
  return {
    id: "inv-1",
    codigo: "A7K2-MQ4X-9BHP",
    email: "juan@example.com",
    nota: null,
    creada_en: "2026-09-20T12:00:00Z",
    caduca_en: "2026-10-20T12:00:00Z",
    reservada_en: null,
    usada_por: null,
    usada_en: null,
    ...cambios,
  };
}

describe("generarCodigo", () => {
  it("devuelve tres grupos de cuatro separados por guiones", () => {
    expect(generarCodigo()).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  });

  it("no usa los caracteres que se confunden al copiarlos a mano", () => {
    const muestra = Array.from({ length: 200 }, () => generarCodigo()).join("");
    expect(muestra).not.toMatch(/[ILO01]/);
  });

  it("no repite códigos", () => {
    const codigos = new Set(Array.from({ length: 500 }, () => generarCodigo()));
    expect(codigos.size).toBe(500);
  });
});

describe("normalizarCodigo", () => {
  it("acepta el código tal cual viene del enlace", () => {
    expect(normalizarCodigo("A7K2-MQ4X-9BHP")).toBe("A7K2-MQ4X-9BHP");
  });

  it("reagrupa un código tecleado sin guiones", () => {
    expect(normalizarCodigo("a7k2mq4x9bhp")).toBe("A7K2-MQ4X-9BHP");
  });

  it("aguanta espacios, minúsculas y guiones de más", () => {
    expect(normalizarCodigo("  a7k2 - mq4x--9bhp ")).toBe("A7K2-MQ4X-9BHP");
  });

  it("deja pasar sin reagrupar lo que no tiene la longitud correcta, para que la validación lo rechace", () => {
    expect(normalizarCodigo("A7K2")).toBe("A7K2");
  });
});

describe("estadoInvitacion", () => {
  it("una invitación reciente sin usar está pendiente", () => {
    expect(estadoInvitacion(invitacion(), AHORA)).toBe("pendiente");
  });

  it("una ya canjeada está usada, aunque no haya caducado", () => {
    expect(estadoInvitacion(invitacion({ usada_en: "2026-09-21T10:00:00Z" }), AHORA)).toBe("usada");
  });

  it("pasada la fecha de caducidad está caducada", () => {
    expect(estadoInvitacion(invitacion({ caduca_en: "2026-09-22T11:59:59Z" }), AHORA)).toBe("caducada");
  });

  it("usada gana a caducada: importa más que ya tiene dueño", () => {
    const vieja = invitacion({ caduca_en: "2026-01-01T00:00:00Z", usada_en: "2025-12-01T00:00:00Z" });
    expect(estadoInvitacion(vieja, AHORA)).toBe("usada");
  });
});

describe("reservaCaducada", () => {
  it("sin reserva, el código está libre", () => {
    expect(reservaCaducada(null, AHORA)).toBe(true);
  });

  it("una reserva de hace un momento todavía cuenta", () => {
    expect(reservaCaducada("2026-09-22T11:58:00Z", AHORA)).toBe(false);
  });

  it("una reserva olvidada hace media hora libera el código", () => {
    expect(reservaCaducada("2026-09-22T11:30:00Z", AHORA)).toBe(true);
  });
});

describe("motivoRechazo", () => {
  it("una invitación válida con su email no se rechaza", () => {
    expect(motivoRechazo(invitacion(), "juan@example.com", AHORA)).toBeNull();
  });

  it("el email se compara sin distinguir mayúsculas ni espacios", () => {
    expect(motivoRechazo(invitacion(), "  Juan@Example.COM ", AHORA)).toBeNull();
  });

  it("un código que no existe se explica como tal", () => {
    expect(motivoRechazo(null, "juan@example.com", AHORA)).toContain("no existe");
  });

  it("con otro email, no sirve aunque el código sea correcto", () => {
    expect(motivoRechazo(invitacion(), "otro@example.com", AHORA)).toContain("para otro email");
  });

  it("una ya usada dice que ya se usó, no que sea inválida", () => {
    const usada = invitacion({ usada_en: "2026-09-21T10:00:00Z" });
    expect(motivoRechazo(usada, "juan@example.com", AHORA)).toContain("ya se ha usado");
  });

  it("una caducada invita a pedir otra", () => {
    const caducada = invitacion({ caduca_en: "2026-09-01T00:00:00Z" });
    expect(motivoRechazo(caducada, "juan@example.com", AHORA)).toContain("caducado");
  });

  it("un alta en curso bloquea el canje en paralelo", () => {
    const enCurso = invitacion({ reservada_en: "2026-09-22T11:59:00Z" });
    expect(motivoRechazo(enCurso, "juan@example.com", AHORA)).toContain("ahora mismo");
  });

  it("una reserva abandonada no bloquea: el código vuelve a estar disponible", () => {
    const abandonada = invitacion({ reservada_en: "2026-09-22T10:00:00Z" });
    expect(motivoRechazo(abandonada, "juan@example.com", AHORA)).toBeNull();
  });
});

describe("validarPassword", () => {
  it("acepta una contraseña de seis caracteres repetida bien", () => {
    expect(validarPassword("secreta", "secreta")).toBeNull();
  });

  it("rechaza las cortas antes de llegar a Supabase", () => {
    expect(validarPassword("abc", "abc")).toContain("6 caracteres");
  });

  it("rechaza las que no coinciden", () => {
    expect(validarPassword("secreta", "secretb")).toContain("no coinciden");
  });

  it("la longitud se comprueba antes que la coincidencia: es el error más concreto", () => {
    expect(validarPassword("abc", "xyz")).toContain("6 caracteres");
  });
});

describe("enlaceInvitacion", () => {
  it("construye la URL de alta con el código", () => {
    expect(enlaceInvitacion("https://midominio.com", "A7K2-MQ4X-9BHP")).toBe(
      "https://midominio.com/registro?codigo=A7K2-MQ4X-9BHP"
    );
  });

  it("no duplica la barra si el origen ya la trae", () => {
    expect(enlaceInvitacion("https://midominio.com/", "A7K2-MQ4X-9BHP")).toContain(".com/registro");
  });
});
