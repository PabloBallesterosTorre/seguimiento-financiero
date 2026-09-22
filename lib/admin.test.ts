import { describe, expect, it } from "vitest";
import { esAdmin, parseAdminEmails } from "./admin";

describe("parseAdminEmails", () => {
  it("parte la lista por comas y normaliza", () => {
    expect(parseAdminEmails(" Uno@Mail.com , dos@mail.com ")).toEqual(["uno@mail.com", "dos@mail.com"]);
  });

  it("sin variable, la lista está vacía", () => {
    expect(parseAdminEmails(undefined)).toEqual([]);
    expect(parseAdminEmails("")).toEqual([]);
  });

  it("descarta los huecos de una lista mal escrita", () => {
    expect(parseAdminEmails("uno@mail.com,,")).toEqual(["uno@mail.com"]);
  });
});

describe("esAdmin", () => {
  const admins = ["jefe@mail.com"];

  it("reconoce al administrador sin distinguir mayúsculas", () => {
    expect(esAdmin("Jefe@Mail.com", admins)).toBe(true);
  });

  it("cualquier otro usuario no lo es", () => {
    expect(esAdmin("amigo@mail.com", admins)).toBe(false);
  });

  it("sin lista configurada, nadie es administrador", () => {
    expect(esAdmin("jefe@mail.com", [])).toBe(false);
  });

  it("sin email tampoco", () => {
    expect(esAdmin(null, admins)).toBe(false);
    expect(esAdmin(undefined, admins)).toBe(false);
  });
});
