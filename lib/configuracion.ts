import type { createClient } from "@/lib/supabase/server";
import type { OpcionesMesFinanciero } from "@/lib/mesFinanciero";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type ConfiguracionUsuario = {
  nombre: string | null;
  moneda_base: string;
  idioma: string;
  objetivo_ahorro_mensual: number | null;
  incluir_inversion_en_ahorro: boolean;
  cuentas_excluidas_informes: string[];
  mes_financiero: boolean;
  dia_corte_mes: number;
  categoria_inicio_mes: string | null;
};

const DEFAULTS: ConfiguracionUsuario = {
  nombre: null,
  moneda_base: "EUR",
  idioma: "es",
  objetivo_ahorro_mensual: null,
  incluir_inversion_en_ahorro: true,
  cuentas_excluidas_informes: [],
  mes_financiero: false,
  dia_corte_mes: 25,
  categoria_inicio_mes: null,
};

// Devuelve la configuración del usuario, o los valores por defecto si todavía no
// ha guardado ninguna (evita tener que crear la fila de antemano en el alta).
export async function obtenerConfiguracion(
  supabase: SupabaseServerClient,
  usuarioId: string
): Promise<ConfiguracionUsuario> {
  // Deliberadamente sin throwOnError: se lee en casi cada carga de página, y ante un
  // fallo puntual es mejor degradar a los valores por defecto que romper la
  // pantalla entera — pero sí se registra, para no perder visibilidad del fallo.
  const { data, error } = await supabase
    .from("configuracion_usuario")
    .select(
      "nombre, moneda_base, idioma, objetivo_ahorro_mensual, incluir_inversion_en_ahorro, cuentas_excluidas_informes, mes_financiero, dia_corte_mes, categoria_inicio_mes"
    )
    .eq("usuario_id", usuarioId)
    .maybeSingle();

  if (error) console.error("obtenerConfiguracion", error);
  if (!data) return DEFAULTS;

  return {
    nombre: data.nombre,
    moneda_base: data.moneda_base,
    idioma: data.idioma,
    objetivo_ahorro_mensual: data.objetivo_ahorro_mensual !== null ? Number(data.objetivo_ahorro_mensual) : null,
    incluir_inversion_en_ahorro: data.incluir_inversion_en_ahorro,
    cuentas_excluidas_informes: data.cuentas_excluidas_informes ?? [],
    mes_financiero: data.mes_financiero ?? false,
    dia_corte_mes: data.dia_corte_mes ?? 25,
    categoria_inicio_mes: data.categoria_inicio_mes ?? null,
  };
}

// Traduce la configuración a las opciones que entiende lib/mesFinanciero, leyendo de paso
// las fechas de las nóminas que sirven de ancla.
//
// Las anclas se buscan solo entre los INGRESOS de la categoría elegida: si algún mes hay
// un movimiento de signo contrario ahí dentro (una devolución a la empresa, un ajuste),
// no tiene sentido que mueva la frontera del mes.
//
// Ante cualquier fallo se devuelve mes natural en vez de romper la pantalla: es el mismo
// criterio que obtenerConfiguracion, y equivocarse por el lado del comportamiento de
// siempre es preferible a no pintar nada.
export async function obtenerOpcionesMesFinanciero(
  supabase: SupabaseServerClient,
  config: ConfiguracionUsuario
): Promise<OpcionesMesFinanciero> {
  if (!config.mes_financiero || !config.categoria_inicio_mes) {
    return { activo: config.mes_financiero, diaCorte: config.dia_corte_mes, anclas: [] };
  }

  const { data, error } = await supabase
    .from("movimientos")
    .select("fecha")
    .eq("categoria_id", config.categoria_inicio_mes)
    .gt("importe", 0)
    .order("fecha");

  if (error) {
    console.error("obtenerOpcionesMesFinanciero", error);
    return { activo: false, diaCorte: config.dia_corte_mes, anclas: [] };
  }

  return {
    activo: true,
    diaCorte: config.dia_corte_mes,
    anclas: (data ?? []).map((m) => m.fecha as string),
  };
}
