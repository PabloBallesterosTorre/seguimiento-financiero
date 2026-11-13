// Tanda 17: el protocolo MCP (JSON-RPC 2.0 sobre HTTP "streamable", en su forma sin
// estado: cada POST trae un mensaje y la respuesta va en el cuerpo como JSON, sin SSE).
// Es todo lo que hace falta para ofrecer herramientas, y evita depender de un SDK que
// cambia de versión cada pocas semanas.
//
// Sin dependencias de Next ni de Supabase: recibe una función que ejecuta la herramienta y
// así se puede probar entera con tests.

import { HERRAMIENTAS } from "./herramientas";

export const VERSIONES_PROTOCOLO = ["2025-06-18", "2025-03-26", "2024-11-05"] as const;

export type MensajeJsonRpc = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};

export type RespuestaJsonRpc =
  | { jsonrpc: "2.0"; id: string | number | null; result: unknown }
  | { jsonrpc: "2.0"; id: string | number | null; error: { code: number; message: string } };

// Ejecuta la función de Postgres de una herramienta. Devuelve el JSON de la función o
// lanza un Error con el mensaje que haya dado la base de datos.
export type EjecutarHerramienta = (rpc: string, parametros: Record<string, unknown>) => Promise<unknown>;

const ok = (id: MensajeJsonRpc["id"], result: unknown): RespuestaJsonRpc => ({ jsonrpc: "2.0", id: id ?? null, result });
const error = (id: MensajeJsonRpc["id"], code: number, message: string): RespuestaJsonRpc => ({
  jsonrpc: "2.0",
  id: id ?? null,
  error: { code, message },
});

// Una notificación (sin id) no lleva respuesta: devuelve null.
export async function procesarMensaje(
  mensaje: MensajeJsonRpc,
  ejecutar: EjecutarHerramienta
): Promise<RespuestaJsonRpc | null> {
  if (!mensaje || typeof mensaje !== "object" || mensaje.jsonrpc !== "2.0" || typeof mensaje.method !== "string") {
    return error(mensaje?.id, -32600, "Petición JSON-RPC no válida");
  }

  const esNotificacion = mensaje.id === undefined;
  if (esNotificacion) return null;

  switch (mensaje.method) {
    case "initialize": {
      const pedida = String(mensaje.params?.protocolVersion ?? "");
      const version = (VERSIONES_PROTOCOLO as readonly string[]).includes(pedida) ? pedida : VERSIONES_PROTOCOLO[0];
      return ok(mensaje.id, {
        protocolVersion: version,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "seguimiento-financiero", version: "1.0.0" },
        instructions:
          "Datos de la app personal de seguimiento financiero del usuario. Importes en euros: negativo = gasto, positivo = ingreso. Los traspasos mueven dinero entre cuentas propias y no son gasto. Antes de filtrar o apuntar, consulta ver_catalogo para usar nombres exactos de categorías, etiquetas y cuentas.",
      });
    }

    case "ping":
      return ok(mensaje.id, {});

    case "tools/list":
      return ok(mensaje.id, {
        tools: HERRAMIENTAS.map(({ name, description, inputSchema, annotations }) => ({
          name,
          description,
          inputSchema,
          annotations,
        })),
      });

    case "tools/call": {
      const nombre = mensaje.params?.name;
      const herramienta = HERRAMIENTAS.find((h) => h.name === nombre);
      if (!herramienta) return error(mensaje.id, -32602, `Herramienta desconocida: ${String(nombre)}`);

      const args = (mensaje.params?.arguments ?? {}) as Record<string, unknown>;
      // Un fallo de la herramienta (clave de solo lectura, categoría que no existe...) no es
      // un error de protocolo: va como resultado con isError, para que el modelo lo lea y
      // pueda corregirse.
      try {
        const datos = await ejecutar(herramienta.rpc, herramienta.parametros(args));
        return ok(mensaje.id, {
          content: [{ type: "text", text: JSON.stringify(datos, null, 2) }],
          structuredContent: Array.isArray(datos) ? { resultados: datos } : (datos as Record<string, unknown>),
        });
      } catch (e) {
        return ok(mensaje.id, {
          content: [{ type: "text", text: e instanceof Error ? e.message : String(e) }],
          isError: true,
        });
      }
    }

    default:
      return error(mensaje.id, -32601, `Método no soportado: ${mensaje.method}`);
  }
}
