// Tanda 17: las herramientas que el servidor MCP ofrece a Claude.
//
// Cada herramienta es una función de Postgres (migración 0038) que recibe la clave del
// usuario y resuelve con ella, dentro de la base de datos, de quién son los datos. Aquí
// solo se describe cada herramienta para el modelo y se traducen sus argumentos a los
// parámetros de la función.

export type Herramienta = {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean };
  // Función de Postgres que la implementa y cómo pasar los argumentos.
  rpc: string;
  parametros: (args: Record<string, unknown>) => Record<string, unknown>;
};

const fecha = { type: "string", format: "date", description: "AAAA-MM-DD" };

function texto(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function listaTextos(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const limpia = v.filter((x): x is string => typeof x === "string" && x.trim() !== "").map((x) => x.trim());
  return limpia.length > 0 ? limpia : null;
}

export const HERRAMIENTAS: Herramienta[] = [
  {
    name: "ver_cuentas",
    description: "Lista las cuentas activas con su banco, saldo actual y ámbito (personal o conjunto), y el total.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    rpc: "mcp_cuentas",
    parametros: () => ({}),
  },
  {
    name: "ver_catalogo",
    description:
      "Nombres de categorías (formato 'Padre › Hija'), etiquetas y cuentas. Úsalo antes de filtrar o apuntar para usar los nombres exactos.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    rpc: "mcp_catalogo",
    parametros: () => ({}),
  },
  {
    name: "buscar_movimientos",
    description:
      "Busca movimientos, del más reciente al más antiguo. Importe negativo = gasto, positivo = ingreso; tipo 'traspaso' = dinero entre cuentas propias. Filtrar por una categoría madre incluye sus subcategorías.",
    inputSchema: {
      type: "object",
      properties: {
        desde: fecha,
        hasta: fecha,
        texto: { type: "string", description: "Texto que contiene el concepto" },
        categoria: { type: "string", description: "Nombre de categoría, p. ej. 'Ocio' o 'Ocio › Restaurantes'" },
        etiqueta: { type: "string", description: "Nombre de etiqueta, sin #" },
        limite: { type: "integer", minimum: 1, maximum: 500, default: 50 },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    rpc: "mcp_movimientos",
    parametros: (a) => ({
      p_desde: texto(a.desde),
      p_hasta: texto(a.hasta),
      p_texto: texto(a.texto),
      p_categoria: texto(a.categoria),
      p_etiqueta: texto(a.etiqueta),
      p_limite: typeof a.limite === "number" ? Math.trunc(a.limite) : 50,
    }),
  },
  {
    name: "resumen_por_categoria",
    description:
      "Neto por categoría madre entre dos fechas, más el total de gastos e ingresos. No cuenta traspasos entre cuentas propias. Usa fechas naturales; la app agrupa los informes de nómina a nómina.",
    inputSchema: {
      type: "object",
      properties: { desde: fecha, hasta: fecha },
      required: ["desde", "hasta"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    rpc: "mcp_resumen_categorias",
    parametros: (a) => ({ p_desde: texto(a.desde), p_hasta: texto(a.hasta) }),
  },
  {
    name: "ver_patrimonio",
    description:
      "Patrimonio neto (cuentas + inversión − deuda) con el detalle de cada inversión (valor, aportado, ganancia) y cada deuda (pendiente, cuota, interés).",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    rpc: "mcp_patrimonio",
    parametros: () => ({}),
  },
  {
    name: "ver_previstos",
    description:
      "Movimientos previstos activos: pagos e ingresos recurrentes o puntuales y presupuestos por categoría (presupuesto=true).",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    rpc: "mcp_previstos",
    parametros: () => ({}),
  },
  {
    name: "apuntar_movimiento",
    description:
      "Da de alta un movimiento en una cuenta y actualiza su saldo. Importe negativo para un gasto, positivo para un ingreso. Necesita una clave con permiso de escritura.",
    inputSchema: {
      type: "object",
      properties: {
        cuenta: { type: "string", description: "Nombre de la cuenta o 'Banco — Nombre'" },
        fecha,
        descripcion: { type: "string" },
        importe: { type: "number", description: "Negativo = gasto, positivo = ingreso" },
        categoria: { type: "string" },
        etiquetas: { type: "array", items: { type: "string" }, description: "Se crean si no existen" },
      },
      required: ["cuenta", "descripcion", "importe"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    rpc: "mcp_crear_movimiento",
    parametros: (a) => ({
      p_cuenta: texto(a.cuenta),
      p_fecha: texto(a.fecha),
      p_descripcion: texto(a.descripcion),
      p_importe: typeof a.importe === "number" ? a.importe : null,
      p_categoria: texto(a.categoria),
      p_etiquetas: listaTextos(a.etiquetas),
    }),
  },
  {
    name: "categorizar_movimiento",
    description:
      "Cambia la categoría de un movimiento (id de buscar_movimientos) y/o le añade etiquetas. Necesita una clave con permiso de escritura.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "id del movimiento" },
        categoria: { type: "string" },
        etiquetas: { type: "array", items: { type: "string" } },
      },
      required: ["id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    rpc: "mcp_categorizar_movimiento",
    parametros: (a) => ({
      p_movimiento: texto(a.id),
      p_categoria: texto(a.categoria),
      p_etiquetas: listaTextos(a.etiquetas),
    }),
  },
];
