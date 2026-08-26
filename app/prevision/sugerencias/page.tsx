import Link from "next/link";
import { Nav } from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { detectarMediaPorCategoria, detectarPatronesPorDescripcion } from "@/lib/deteccionPatrones";
import { crearMovimientoPrevisto, descartarSugerenciaPrevision } from "../actions";
import { ConfirmForm } from "@/components/ConfirmForm";
import { obtenerConfiguracion } from "@/lib/configuracion";
import { formatMoneda } from "@/lib/formato";

const ETIQUETA_PERIODICIDAD: Record<string, string> = {
  mensual: "Mensual",
  bimensual: "Bimensual",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
};

export default async function SugerenciasPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const desde = new Date();
  desde.setFullYear(desde.getFullYear() - 3);

  const [{ data: movimientos }, { data: categorias }, { data: previstos }, { data: descartados }, config] =
    await Promise.all([
      supabase
        .from("movimientos")
        .select("descripcion, categoria_id, tipo, importe, fecha")
        .in("tipo", ["ingreso", "gasto"])
        .gte("fecha", desde.toISOString().slice(0, 10)),
      supabase.from("categorias").select("id, nombre, categoria_padre_id"),
      supabase.from("movimientos_previstos").select("descripcion, categoria_id, tipo, tipo_recurrencia, estado"),
      supabase.from("patrones_descartados").select("nivel, clave"),
      user ? obtenerConfiguracion(supabase, user.id) : null,
    ]);

  const formatEUR = (v: number) => formatMoneda(v, config?.moneda_base ?? "EUR");

  const nombreCategoria = new Map((categorias ?? []).map((c) => [c.id, c.nombre]));
  const categoriaPadreId = new Map((categorias ?? []).map((c) => [c.id, c.categoria_padre_id as string | null]));
  const categoriaEfectiva = (categoriaId: string) => categoriaPadreId.get(categoriaId) ?? categoriaId;

  const historico = (movimientos ?? []) as Array<{
    descripcion: string;
    categoria_id: string | null;
    tipo: "ingreso" | "gasto";
    importe: number;
    fecha: string;
  }>;

  const clavesExistentesDescripcion = new Set(
    (previstos ?? [])
      .filter((p) => p.tipo !== "traspaso")
      .map((p) => `${p.tipo}:${p.descripcion.trim().toLowerCase()}`)
  );
  // Cualquier previsión recurrente ya existente para una categoría (dada de alta a
  // mano o generada automáticamente, ej. la cuota de una deuda) cubre esa categoría
  // por completo — no se vuelve a sugerir un patrón para ella, aunque la descripción
  // del patrón detectado no coincida literalmente con la de la previsión manual.
  const clavesExistentesCategoria = new Set(
    (previstos ?? [])
      .filter((p) => p.categoria_id && p.tipo_recurrencia === "recurrente")
      .map((p) => `${p.tipo}:${p.categoria_id}`)
  );

  const descripcionesDescartadas = new Set(
    (descartados ?? []).filter((d) => d.nivel === "descripcion").map((d) => d.clave)
  );
  const categoriasDescartadas = new Set(
    (descartados ?? []).filter((d) => d.nivel === "categoria").map((d) => d.clave)
  );

  const candidatosDescripcion = detectarPatronesPorDescripcion(historico).filter(
    (c) =>
      !clavesExistentesDescripcion.has(c.clave) &&
      !descripcionesDescartadas.has(c.clave) &&
      !(c.categoria_id && clavesExistentesCategoria.has(`${c.tipo}:${c.categoria_id}`))
  );
  const clavesCubiertas = new Set(candidatosDescripcion.map((c) => c.clave));
  const candidatosCategoria = detectarMediaPorCategoria(historico, clavesCubiertas, categoriaEfectiva).filter(
    (c) => !clavesExistentesCategoria.has(c.clave) && !categoriasDescartadas.has(c.clave)
  );

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-4 py-8 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Sugerencias de previsión</h1>
          <Link href="/prevision" className="text-sm text-slate-500 hover:text-slate-900">
            ← Ver proyección
          </Link>
        </div>
        <p className="text-sm text-slate-400">
          Basado en tu histórico de movimientos (últimos 3 años). Nada se activa hasta que aceptes cada
          sugerencia — cuanto más histórico tengas, más patrones y con más confianza se detectan.
        </p>

        <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
          <h2 className="text-sm font-medium text-slate-700">Patrones por transacción repetida</h2>
          {candidatosDescripcion.length === 0 ? (
            <p className="text-sm text-slate-400">
              No se ha detectado ningún patrón nuevo (mensual con ≥3 repeticiones, o anual con ≥2).
            </p>
          ) : (
            <div className="space-y-3">
              {candidatosDescripcion.map((c) => (
                <div
                  key={c.clave}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-100 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">{c.descripcion}</p>
                    <p className="text-xs text-slate-500">
                      {ETIQUETA_PERIODICIDAD[c.periodicidad]} · {c.ocurrencias} repeticiones ·{" "}
                      {c.categoria_id ? nombreCategoria.get(c.categoria_id) ?? "Categoría eliminada" : "Sin categoría"}{" "}
                      · próxima estimada {c.proximaFecha}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">{formatEUR(c.importe_estimado)}</span>
                    <ConfirmForm
                      action={descartarSugerenciaPrevision}
                      mensaje={`¿Descartar "${c.descripcion}" como patrón? No se te volverá a proponer.`}
                      className="inline"
                    >
                      <input type="hidden" name="nivel" value="descripcion" />
                      <input type="hidden" name="clave" value={c.clave} />
                      <button
                        type="submit"
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50"
                      >
                        Descartar
                      </button>
                    </ConfirmForm>
                    <form action={crearMovimientoPrevisto}>
                      <input type="hidden" name="descripcion" value={c.descripcion} />
                      <input type="hidden" name="tipo" value={c.tipo} />
                      <input type="hidden" name="categoria_id" value={c.categoria_id ?? ""} />
                      <input type="hidden" name="importe_estimado" value={c.importe_estimado} />
                      <input type="hidden" name="tipo_recurrencia" value="recurrente" />
                      <input type="hidden" name="periodicidad" value={c.periodicidad} />
                      <input type="hidden" name="fecha_inicio" value={c.proximaFecha} />
                      <input type="hidden" name="origen_calculo" value="fijo" />
                      <button
                        type="submit"
                        className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
                      >
                        Aceptar
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
          <h2 className="text-sm font-medium text-slate-700">Media mensual por categoría</h2>
          <p className="text-xs text-slate-400">
            Para gasto/ingreso variable sin un patrón de descripción único (ej. Ocio, Compras).
          </p>
          {candidatosCategoria.length === 0 ? (
            <p className="text-sm text-slate-400">
              No hay categorías con histórico suficiente (mínimo 2 meses con movimientos) que no estén ya
              cubiertas por un patrón por transacción.
            </p>
          ) : (
            <div className="space-y-3">
              {candidatosCategoria.map((c) => {
                const nombre = nombreCategoria.get(c.categoria_id) ?? "Categoría eliminada";
                const hoy = new Date().toISOString().slice(0, 10);
                return (
                  <div
                    key={c.clave}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-100 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">{nombre}</p>
                      <p className="text-xs text-slate-500">Media sobre {c.mesesConDatos} meses con datos</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">{formatEUR(c.importe_estimado)}/mes</span>
                      <ConfirmForm
                        action={descartarSugerenciaPrevision}
                        mensaje={`¿Descartar "${nombre}" como patrón? No se te volverá a proponer.`}
                        className="inline"
                      >
                        <input type="hidden" name="nivel" value="categoria" />
                        <input type="hidden" name="clave" value={c.clave} />
                        <button
                          type="submit"
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50"
                        >
                          Descartar
                        </button>
                      </ConfirmForm>
                      <form action={crearMovimientoPrevisto}>
                        <input type="hidden" name="descripcion" value={`Media mensual — ${nombre}`} />
                        <input type="hidden" name="tipo" value={c.tipo} />
                        <input type="hidden" name="categoria_id" value={c.categoria_id} />
                        <input type="hidden" name="importe_estimado" value={c.importe_estimado} />
                        <input type="hidden" name="tipo_recurrencia" value="recurrente" />
                        <input type="hidden" name="periodicidad" value="mensual" />
                        <input type="hidden" name="fecha_inicio" value={hoy} />
                        <input type="hidden" name="origen_calculo" value="media_categoria" />
                        <button
                          type="submit"
                          className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
                        >
                          Aceptar
                        </button>
                      </form>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
