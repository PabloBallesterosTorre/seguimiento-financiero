import { Nav } from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { crearInversion, editarInversion, registrarValoracionInversion, eliminarInversion } from "./actions";
import { NuevaInversion } from "./NuevaInversion";
import { InversionesClient } from "./InversionesClient";
import { obtenerConfiguracion } from "@/lib/configuracion";
import { formatMoneda } from "@/lib/formato";
import { cardClass } from "@/components/formStyles";
import type { PrevistoInversionOption } from "./InversionForm";

export default async function InversionesPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: inversiones }, { data: categorias }, { data: previstosRaw }, config] = await Promise.all([
    supabase.from("inversiones").select("*").order("created_at", { ascending: true }),
    supabase.from("categorias").select("id, categoria_padre_id, es_categoria_inversion"),
    supabase
      .from("movimientos_previstos")
      .select("id, descripcion, importe_estimado, tipo, categoria_id, tipo_recurrencia")
      .eq("tipo", "gasto")
      .eq("tipo_recurrencia", "recurrente"),
    user ? obtenerConfiguracion(supabase, user.id) : null,
  ]);

  const formatEUR = (v: number) => formatMoneda(v, config?.moneda_base ?? "EUR");
  const total = (inversiones ?? []).reduce((sum, i) => sum + Number(i.valor_actual ?? 0), 0);

  const categoriaPadreId = new Map((categorias ?? []).map((c) => [c.id, c.categoria_padre_id as string | null]));
  const categoriaEsInversion = new Map((categorias ?? []).map((c) => [c.id, c.es_categoria_inversion === true]));
  const esCategoriaInversion = (categoriaId: string | null) => {
    if (!categoriaId) return false;
    const efectiva = categoriaPadreId.get(categoriaId) ?? categoriaId;
    return categoriaEsInversion.get(efectiva) === true || categoriaEsInversion.get(categoriaId) === true;
  };

  const previstosInversion: PrevistoInversionOption[] = (previstosRaw ?? [])
    .filter((p) => esCategoriaInversion(p.categoria_id))
    .map((p) => ({ id: p.id, descripcion: p.descripcion, importe_estimado: Number(p.importe_estimado) }));

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl space-y-6 px-5 py-8 sm:px-10">
        <div className="flex items-center justify-between">
          <h1 className="font-sora text-[26px] font-bold text-ink">Inversión</h1>
          <p className="text-[13px] text-ink-secondary">
            Total: <span className="font-semibold text-ink">{formatEUR(total)}</span>
          </p>
        </div>

        <NuevaInversion action={crearInversion} previstosInversion={previstosInversion} />

        <InversionesClient
          inversiones={(inversiones ?? []).map((i) => ({
            id: i.id,
            tipo_activo: i.tipo_activo,
            nombre: i.nombre,
            valor_actual: Number(i.valor_actual),
            fecha_actualizacion: i.fecha_actualizacion,
            es_recurrente: i.es_recurrente,
            movimiento_previsto_id: i.movimiento_previsto_id,
            rentabilidad_anual_asumida: i.rentabilidad_anual_asumida !== null ? Number(i.rentabilidad_anual_asumida) : null,
          }))}
          moneda={config?.moneda_base ?? "EUR"}
          previstosInversion={previstosInversion}
          registrarValoracionInversion={registrarValoracionInversion}
          editarInversion={editarInversion}
          eliminarInversion={eliminarInversion}
        />

        <div className={cardClass}>
          <p className="text-[13px] text-ink-tertiary">
            El valor de cada inversión se actualiza a mano — la sincronización automática con
            bróker/exchange (Stooq para acciones/ETF, CoinGecko para cripto) es una mejora de fase 2.
            Entre dos actualizaciones, la evolución diaria que se muestra en el detalle de cada
            inversión es una <span className="font-semibold text-ink">estimación</span>, no el valor de
            mercado real día a día.
          </p>
        </div>
      </main>
    </>
  );
}
