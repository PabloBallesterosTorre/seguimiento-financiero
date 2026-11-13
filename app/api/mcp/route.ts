import { createClient } from "@supabase/supabase-js";
import { claveDeCabecera } from "@/lib/mcp/claves";
import { procesarMensaje, type MensajeJsonRpc } from "@/lib/mcp/protocolo";

// Tanda 17: servidor MCP de la app, para usarla desde Claude Code.
//
//   claude mcp add --transport http finanzas https://<dominio>/api/mcp \
//     --header "Authorization: Bearer sf_..."
//
// La autenticación es la clave personal del encabezado. Este archivo NO decide de quién son
// los datos: pasa la clave a funciones de Postgres (migración 0038) que la resuelven a un
// usuario y solo leen o escriben lo suyo. Por eso basta con la anon key, sin sesión.

export const dynamic = "force-dynamic";

function noAutorizado() {
  return Response.json(
    { jsonrpc: "2.0", id: null, error: { code: -32001, message: "Falta una clave válida: Authorization: Bearer sf_..." } },
    { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="seguimiento-financiero"' } }
  );
}

export async function POST(request: Request) {
  const clave = claveDeCabecera(request.headers.get("authorization"));
  if (!clave) return noAutorizado();

  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "JSON no válido" } }, { status: 400 });
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Antes de nada se comprueba la clave con la herramienta más barata: una clave revocada
  // o inventada recibe un 401 en vez de un "initialize" correcto que luego falla en todo.
  const { error: errorClave } = await supabase.rpc("mcp_cuentas", { p_clave: clave });
  if (errorClave) {
    if (errorClave.code === "28000") return noAutorizado();
    console.error("api/mcp: comprobación de clave", errorClave);
    return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32603, message: "Error interno" } }, { status: 500 });
  }

  const ejecutar = async (rpc: string, parametros: Record<string, unknown>) => {
    const { data, error } = await supabase.rpc(rpc, { p_clave: clave, ...parametros });
    if (error) throw new Error(error.message);
    return data;
  };

  const mensajes = Array.isArray(cuerpo) ? cuerpo : [cuerpo];
  const respuestas = (
    await Promise.all(mensajes.map((m) => procesarMensaje(m as MensajeJsonRpc, ejecutar)))
  ).filter((r) => r !== null);

  // Solo notificaciones: se aceptan sin cuerpo, como pide la especificación.
  if (respuestas.length === 0) return new Response(null, { status: 202 });
  return Response.json(Array.isArray(cuerpo) ? respuestas : respuestas[0]);
}

// Sin estado: no hay flujo SSE que abrir con GET ni sesión que cerrar con DELETE.
export async function GET() {
  return new Response("Método no permitido", { status: 405, headers: { Allow: "POST" } });
}

export async function DELETE() {
  return new Response("Método no permitido", { status: 405, headers: { Allow: "POST" } });
}
