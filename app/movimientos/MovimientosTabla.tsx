"use client";

import { ConfirmForm } from "@/components/ConfirmForm";
import { CategoriaCelda } from "./CategoriaCelda";
import { MarcarComoTraspaso } from "./MarcarComoTraspaso";
import { formatMoneda } from "@/lib/formato";
import { ordenarFilas, type OrdenTabla } from "@/lib/ordenTabla";
import { useOrdenTabla, ThOrdenable } from "@/components/OrdenTabla";
import type { CategoriaJerarquica } from "@/lib/categorias";
import type { CandidatoTraspaso } from "@/lib/traspasos";

function formatFecha(value: string) {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(new Date(value));
}

export type MovimientoFila = {
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
  sugeridaId?: string | null;
  candidatosTraspaso: CandidatoTraspaso[];
};

export function MovimientosTabla({
  tablaKey,
  movimientos,
  categoriasOrdenadas,
  moneda,
  ordenInicial = null,
  mensajeVacio,
  actualizarCategoriaMovimiento,
  vincularComoTraspaso,
  eliminarTraspaso,
  eliminarMovimiento,
}: {
  tablaKey: string;
  movimientos: MovimientoFila[];
  categoriasOrdenadas: CategoriaJerarquica[];
  moneda: string;
  ordenInicial?: OrdenTabla;
  mensajeVacio?: string;
  actualizarCategoriaMovimiento: (formData: FormData) => void;
  vincularComoTraspaso: (formData: FormData) => void;
  eliminarTraspaso: (formData: FormData) => void;
  eliminarMovimiento: (formData: FormData) => void;
}) {
  const formatEUR = (v: number) => formatMoneda(v, moneda);
  const { orden, toggle } = useOrdenTabla(tablaKey, ordenInicial);

  const filasOrdenadas = ordenarFilas(movimientos, orden, {
    fecha: (m) => m.fecha,
    cuenta: (m) => (m.cuentas ? `${m.cuentas.banco_nombre} ${m.cuentas.nombre}` : null),
    descripcion: (m) => m.descripcion,
    categoria: (m) => m.categorias?.nombre ?? null,
    importe: (m) => Number(m.importe),
  });

  return (
    <table className="w-full text-sm">
      <thead className="bg-slate-50 text-left text-slate-500">
        <tr>
          <ThOrdenable columna="fecha" orden={orden} onToggle={toggle}>Fecha</ThOrdenable>
          <ThOrdenable columna="cuenta" orden={orden} onToggle={toggle}>Cuenta</ThOrdenable>
          <ThOrdenable columna="descripcion" orden={orden} onToggle={toggle}>Descripción</ThOrdenable>
          <ThOrdenable columna="categoria" orden={orden} onToggle={toggle}>Categoría</ThOrdenable>
          <ThOrdenable columna="importe" orden={orden} onToggle={toggle} align="right">Importe</ThOrdenable>
          <th className="px-4 py-2"></th>
        </tr>
      </thead>
      <tbody>
        {filasOrdenadas.map((mov) => (
          <FilaMovimiento
            key={mov.id}
            mov={mov}
            categoriasOrdenadas={categoriasOrdenadas}
            formatEUR={formatEUR}
            actualizarCategoriaMovimiento={actualizarCategoriaMovimiento}
            vincularComoTraspaso={vincularComoTraspaso}
            eliminarTraspaso={eliminarTraspaso}
            eliminarMovimiento={eliminarMovimiento}
          />
        ))}
        {filasOrdenadas.length === 0 && mensajeVacio && (
          <tr>
            <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
              {mensajeVacio}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function FilaMovimiento({
  mov,
  categoriasOrdenadas,
  formatEUR,
  actualizarCategoriaMovimiento,
  vincularComoTraspaso,
  eliminarTraspaso,
  eliminarMovimiento,
}: {
  mov: MovimientoFila;
  categoriasOrdenadas: CategoriaJerarquica[];
  formatEUR: (v: number) => string;
  actualizarCategoriaMovimiento: (formData: FormData) => void;
  vincularComoTraspaso: (formData: FormData) => void;
  eliminarTraspaso: (formData: FormData) => void;
  eliminarMovimiento: (formData: FormData) => void;
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
              sugeridaId={mov.sugeridaId}
            />
            <MarcarComoTraspaso
              movimientoId={mov.id}
              candidatos={mov.candidatosTraspaso.map((c) => ({
                id: c.id,
                label: `${c.cuenta ? `${c.cuenta.banco_nombre} — ${c.cuenta.nombre}` : "?"} · ${c.fecha} · ${formatEUR(c.importe)}`,
              }))}
              action={vincularComoTraspaso}
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
