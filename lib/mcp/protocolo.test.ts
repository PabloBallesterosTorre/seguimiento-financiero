import { describe, expect, it, vi } from "vitest";
import { procesarMensaje } from "./protocolo";
import { HERRAMIENTAS } from "./herramientas";

const sinUso = async () => {
  throw new Error("no debería llamarse");
};

describe("procesarMensaje", () => {
  it("initialize devuelve la versión pedida si la soporta, y si no la más reciente", async () => {
    const r1 = await procesarMensaje(
      { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26" } },
      sinUso
    );
    expect(r1).toMatchObject({ id: 1, result: { protocolVersion: "2025-03-26", capabilities: { tools: {} } } });

    const r2 = await procesarMensaje(
      { jsonrpc: "2.0", id: 2, method: "initialize", params: { protocolVersion: "1999-01-01" } },
      sinUso
    );
    expect(r2).toMatchObject({ result: { protocolVersion: "2025-06-18" } });
  });

  it("las notificaciones no tienen respuesta", async () => {
    expect(await procesarMensaje({ jsonrpc: "2.0", method: "notifications/initialized" }, sinUso)).toBeNull();
  });

  it("tools/list no expone cómo se implementa cada herramienta", async () => {
    const r = (await procesarMensaje({ jsonrpc: "2.0", id: 3, method: "tools/list" }, sinUso)) as {
      result: { tools: Record<string, unknown>[] };
    };
    expect(r.result.tools).toHaveLength(HERRAMIENTAS.length);
    for (const t of r.result.tools) {
      expect(Object.keys(t).sort()).toEqual(["annotations", "description", "inputSchema", "name"]);
    }
  });

  it("tools/call traduce los argumentos y devuelve el resultado como texto y estructurado", async () => {
    const ejecutar = vi.fn(async () => ({ total: 10 }));
    const r = await procesarMensaje(
      {
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: { name: "buscar_movimientos", arguments: { texto: " cabify ", limite: 5.7, etiqueta: "" } },
      },
      ejecutar
    );
    expect(ejecutar).toHaveBeenCalledWith("mcp_movimientos", {
      p_desde: null,
      p_hasta: null,
      p_texto: "cabify",
      p_categoria: null,
      p_etiqueta: null,
      p_limite: 5,
    });
    expect(r).toMatchObject({ result: { structuredContent: { total: 10 } } });
  });

  it("un fallo de la herramienta vuelve como resultado con isError, no como error de protocolo", async () => {
    const r = await procesarMensaje(
      {
        jsonrpc: "2.0",
        id: 5,
        method: "tools/call",
        params: { name: "apuntar_movimiento", arguments: { cuenta: "x", descripcion: "x", importe: -1 } },
      },
      async () => {
        throw new Error("Esta clave es de solo lectura");
      }
    );
    expect(r).toEqual({
      jsonrpc: "2.0",
      id: 5,
      result: { content: [{ type: "text", text: "Esta clave es de solo lectura" }], isError: true },
    });
  });

  it("rechaza herramientas y métodos desconocidos y mensajes mal formados", async () => {
    expect(
      await procesarMensaje({ jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "borrar_todo" } }, sinUso)
    ).toMatchObject({ error: { code: -32602 } });
    expect(await procesarMensaje({ jsonrpc: "2.0", id: 7, method: "resources/list" }, sinUso)).toMatchObject({
      error: { code: -32601 },
    });
    expect(await procesarMensaje({ id: 8, method: "ping" }, sinUso)).toMatchObject({ error: { code: -32600 } });
  });
});
