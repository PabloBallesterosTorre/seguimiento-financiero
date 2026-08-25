import Link from "next/link";
import { Nav } from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import {
  actualizarCategoriaMovimiento,
  crearMovimiento,
  crearTraspaso,
  eliminarMovimiento,
  eliminarTraspaso,
  vincularComoTraspaso,
} from "./actions";
import { NuevoMovimiento } from "./NuevoMovimiento";
import { NuevoTraspaso } from "./NuevoTraspaso";
import { CategoriaCelda } from "./CategoriaCelda";
import { MarcarComoTraspaso } from "./MarcarComoTraspaso";
import { ConfirmForm } from "@/components/ConfirmForm";
import { ordenarCategoriasJerarquia, type CategoriaJerarquica } from "@/lib/categorias";
import { sugerirCategoria, type ReglaCategorizacion } from "@/lib/categorizacion";
import { obtenerConfiguracion } from "@/lib/configuracion";
import { formatMoneda } from "@/lib/formato";
import { encontrarCandidatosTraspaso, type CandidatoTraspaso } from "@/lib/traspasos";

function formatFecha(value: string) {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(new Date(value));
}

type Movimiento = {
  id: string;
  cuenta_id: string | null;
  fecha: string;
  descripcion: string;
  importe: number;
  tipo: string;
  categoria_id: string | null;
  traspaso_grupo_id: string | null;
  tipo_original: string | null;
  cuentas: { nombre: string; banco_nombre: string } | null;
  categorias: { nombre: string } | null;
};

function FilaMovimiento({
  mov,
  categoriasOrdenadas,
  candidatosTraspaso,
  sugeridaId,
  formatEUR,
}: {
  mov: Movimiento;
  categoriasOrdenadas: CategoriaJerarquica[];
  candidatosTraspaso: CandidatoTraspaso[];
  sugeridaId?: string | null;
  formatEUR: (v: number) => string;
}) {
  const esTraspaso = mov.tipo === "traspaso";

  return (
    <tr className="border-t border-slate-100">
      <td className="px-4 py-2 whitespace-nowrap text-slate-500">{formatFecha(mov.fecha)}</td>
      <td className="px-4 py-2 whitespace-nowrap">
        {mov.cuentas ? `${mov.cuentas.banco_nombre} — ${mov.cuentas.nombre}` : "—"}
      </td>
      <td className="px-4 py-2">
        {mov.descripcion}
        {esTraspaso && (
          <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">
            Traspaso
          </span>
        )}
      </td>
      <td className="px-4 py-2">
        {esTraspaso ? (
          <span className="text-slate-500">—</span>
        ) : (
          <>
            <CategoriaCelda
              movimientoId={mov.id}
              descripcion={mov.descripcion}
              categoriaId={mov.categoria_id}
              categorias={categoriasOrdenadas}
              action={actualizarCategoriaMovimiento}
              sugeridaId={sugeridaId}
            />
            <MarcarComoTraspaso
              movimientoId={mov.id}
              candidatos={candidatosTraspaso}
              action={vincularComoTraspaso}
              formatEUR={formatEUR}
            />
          </>
        )}
      </td>
      <td
        className={`px-4 py-2 text-right font-medium ${
          esTraspaso ? "text-sky-700" : Number(mov.importe) < 0 ? "text-slate-900" : "text-emerald-600"
        }`}
      >
        {formatEUR(Number(mov.importe))}
      </td>
      <td className="px-4 py-2 text-right">
        {esTraspaso ? (
          <ConfirmForm
            action={eliminarTraspaso}
            mensaje={
              mov.tipo_original
                ? "¿Seguro que quieres desvincular este traspaso? Los dos movimientos volverán a su tipo original (ingreso/gasto) sin categoría; los saldos no cambian."
                : "¿Seguro que quieres eliminar este traspaso? Se eliminarán los dos movimientos enlazados (origen y destino) y se revertirán ambos saldos."
            }
          >
            <input type="hidden" name="traspaso_grupo_id" value={mov.traspaso_grupo_id ?? ""} />
            <button className="text-slate-400 hover:text-red-600" type="submit">
              {mov.tipo_original ? "Desvincular" : "Eliminar"}
            </button>
          </ConfirmForm>
        ) : (
          <ConfirmForm
            action={eliminarMovimiento}
            mensaje={`¿Seguro que quieres eliminar el movimiento "${mov.descripcion}" (${formatEUR(Number(mov.importe))})?`}
          >
            <input type="hidden" name="id" value={mov.id} />
            <button className="text-slate-400 hover:text-red-600" type="submit">
              Eliminar
            </button>
          </ConfirmForm>
        )}
      </td>
    </tr>
  );
}

export default async function MovimientosPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: movimientos }, { data: cuentas }, { data: categorias }, { data: reglas }, config] =
    await Promise.all([
      supabase
        .from("movimientos")
        .select("*, cuentas(nombre, banco_nombre), categorias!categoria_id(nombre)")
        .order("fecha", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("cuentas").select("id, nombre, banco_nombre").eq("activa", true).order("nombre"),
      supabase.from("categorias").select("id, nombre, categoria_padre_id").order("nombre"),
      supabase.from("reglas_categorizacion").select("patron_descripcion, categoria_id, veces_usada"),
      user ? obtenerConfiguracion(supabase, user.id) : null,
    ]);

  const categoriasOrdenadas = ordenarCategoriasJerarquia(categorias ?? []);
  const hayCuentas = (cuentas ?? []).length > 0;
  const hoy = new Date().toISOString().slice(0, 10);
  const formatEUR = (v: number) => formatMoneda(v, config?.moneda_base ?? "EUR");
  const reglasCategorizacion = (reglas ?? []) as ReglaCategorizacion[];

  const todos = (movimientos ?? []) as unknown as Movimiento[];
  const sinCategorizar = todos.filter((m) => m.tipo !== "traspaso" && !m.categoria_id);
  const categorizados = todos.filter((m) => m.tipo === "traspaso" || m.categoria_id);

  const candidatosPorMovimiento = new Map<string, CandidatoTraspaso[]>(
    todos
      .filter((m) => m.tipo !== "traspaso")
      .map((m) => [m.id, encontrarCandidatosTraspaso(m, todos)])
  );

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-4 py-8 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Movimientos</h1>
          <div className="flex items-center gap-3">
            <NuevoTraspaso cuentas={cuentas ?? []} action={crearTraspaso} hoy={hoy} />
            <Link
              href="/movimientos/importar"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Importar CSV
            </Link>
          </div>
        </div>

        {sinCategorizar.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-amber-200 bg-white">
            <div className="border-b border-amber-100 bg-amber-50 px-4 py-2">
              <h2 className="text-sm font-medium text-amber-800">
                Sin categorizar ({sinCategorizar.length})
              </h2>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Fecha</th>
                  <th className="px-4 py-2 font-medium">Cuenta</th>
                  <th className="px-4 py-2 font-medium">Descripción</th>
                  <th className="px-4 py-2 font-medium">Categoría</th>
                  <th className="px-4 py-2 font-medium text-right">Importe</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {sinCategorizar.map((mov) => (
                  <FilaMovimiento
                    key={mov.id}
                    mov={mov}
                    categoriasOrdenadas={categoriasOrdenadas}
                    candidatosTraspaso={candidatosPorMovimiento.get(mov.id) ?? []}
                    sugeridaId={sugerirCategoria(mov.descripcion, reglasCategorizacion)}
                    formatEUR={formatEUR}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Fecha</th>
                <th className="px-4 py-2 font-medium">Cuenta</th>
                <th className="px-4 py-2 font-medium">Descripción</th>
                <th className="px-4 py-2 font-medium">Categoría</th>
                <th className="px-4 py-2 font-medium text-right">Importe</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {categorizados.map((mov) => (
                <FilaMovimiento
                  key={mov.id}
                  mov={mov}
                  categoriasOrdenadas={categoriasOrdenadas}
                  candidatosTraspaso={candidatosPorMovimiento.get(mov.id) ?? []}
                  formatEUR={formatEUR}
                />
              ))}
              {categorizados.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                    Todavía no hay movimientos categorizados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {!hayCuentas ? (
          <p className="text-sm text-slate-400">
            Antes de añadir movimientos, da de alta una cuenta en la sección Cuentas.
          </p>
        ) : (
          <NuevoMovimiento
            action={crearMovimiento}
            cuentas={cuentas ?? []}
            categorias={categoriasOrdenadas}
            reglas={reglasCategorizacion}
            hoy={hoy}
          />
        )}
      </main>
    </>
  );
}
