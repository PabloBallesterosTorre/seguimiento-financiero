import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type ConfiguracionUsuario = {
  nombre: string | null;
  moneda_base: string;
  idioma: string;
  objetivo_ahorro_mensual: number | null;
  incluir_inversion_en_ahorro: boolean;
};

const DEFAULTS: ConfiguracionUsuario = {
  nombre: null,
  moneda_base: "EUR",
  idioma: "es",
  objetivo_ahorro_mensual: null,
  incluir_inversion_en_ahorro: true,
};

// Devuelve la configuración del usuario, o los valores por defecto si todavía no
// ha guardado ninguna (evita tener que crear la fila de antemano en el alta).
export async function obtenerConfiguracion(
  supabase: SupabaseServerClient,
  usuarioId: string
): Promise<ConfiguracionUsuario> {
  const { data } = await supabase
    .from("configuracion_usuario")
    .select("nombre, moneda_base, idioma, objetivo_ahorro_mensual, incluir_inversion_en_ahorro")
    .eq("usuario_id", usuarioId)
    .maybeSingle();

  if (!data) return DEFAULTS;

  return {
    nombre: data.nombre,
    moneda_base: data.moneda_base,
    idioma: data.idioma,
    objetivo_ahorro_mensual: data.objetivo_ahorro_mensual !== null ? Number(data.objetivo_ahorro_mensual) : null,
    incluir_inversion_en_ahorro: data.incluir_inversion_en_ahorro,
  };
}
