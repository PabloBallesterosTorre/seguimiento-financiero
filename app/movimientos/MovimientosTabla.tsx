"use client";

import { ConfirmForm } from "@/components/ConfirmForm";
import { CategoriaCelda } from "./CategoriaCelda";
import { MarcarComoTraspaso } from "./MarcarComoTraspaso";
import { AsignarAInversion, type InversionOption } from "./AsignarAInversion";
import { formatMonedaTabla } from "@/lib/formato";
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
  // Solo para los movimientos de categoría inversión: nombre de la posición a la que ya
  // están vinculados, o null si todavía no lo están.
  esAporteInversion?: boolean;
  inversionAsignada?: string | null;
};

export function MovimientosTabla({
  tablaKey,
  movimientos,
  categoriasOrdenadas,
  moneda,
  ordenInicial = null,
  mensajeVacio,
  inversiones,
  actualizarCategoriaMovimiento,
  vincularComoTraspaso,
  eliminarTraspaso,
  eliminarMovimiento,
  asignarMovimientoAInversion,
}: {
  tablaKey: string;
  movimientos: MovimientoFila[];
  categoriasOrdenadas: CategoriaJerarquica[];
  moneda: string;
  ordenInicial?: OrdenTabla;
  mensajeVacio?: string;
  inversiones: InversionOption[];
  actualizarCategoriaMovimiento: (formData: FormData) => void;
  vincularComoTraspaso: (formData: FormData) => void;
  eliminarTraspaso: (formData: FormData) => void;
  eliminarMovimiento: (formData: FormData) => void;
  asignarMovimientoAInversion: (formData: FormData) => void;
}) {
  const formatEUR = (v: number) => formatMonedaTabla(v, moneda);
  const { orden, toggle } = useOrdenTabla(tablaKey, ordenInicial);

  // Neto de lo que se muestra, para el pie de la tabla.
  const hayTraspasos = movimientos.some((m) => m.tipo === "traspaso");
  const neto = movimientos
    .filter((m) => m.tipo !== "traspaso")
    .reduce((suma, m) => suma + Number(m.importe), 0);

  const filasOrdenadas = ordenarFilas(movimientos, orden, {
    fecha: (m) => m.fecha,
    cuenta: (m) => (m.cuentas ? `${m.cuentas.banco_nombre} ${m.cuentas.nombre}` : null),
    descripcion: (m) => m.descripcion,
    categoria: (m) => m.categorias?.nombre ?? null,
    importe: (m) => Number(m.importe),
  });

  return (
    <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border">
          <ThOrdenable columna="fecha" orden={orden} onToggle={toggle}>Fecha</ThOrdenable>
          <ThOrdenable columna="cuenta" orden={orden} onToggle={toggle}>Cuenta</ThOrdenable>
          <ThOrdenable columna="descripcion" orden={orden} onToggle={toggle}>Descripción</ThOrdenable>
          <ThOrdenable columna="categoria" orden={orden} onToggle={toggle}>Categoría</ThOrdenable>
          <ThOrdenable columna="importe" orden={orden} onToggle={toggle} align="right">Importe</ThOrdenable>
          <th className="px-4 py-3"></th>
        </tr>
      </thead>
      <tbody>
        {filasOrdenadas.map((mov) => (
          <FilaMovimiento
            key={mov.id}
            mov={mov}
            categoriasOrdenadas={categoriasOrdenadas}
            formatEUR={formatEUR}
            inversiones={inversiones}
            actualizarCategoriaMovimiento={actualizarCategoriaMovimiento}
            vincularComoTraspaso={vincularComoTraspaso}
            eliminarTraspaso={eliminarTraspaso}
            eliminarMovimiento={eliminarMovimiento}
            asignarMovimientoAInversion={asignarMovimientoAInversion}
          />
        ))}
        {filasOrdenadas.length === 0 && mensajeVacio && (
          <tr>
            <td colSpan={6} className="px-4 py-6 text-center text-ink-tertiary">
              {mensajeVacio}
            </td>
          </tr>
        )}
      </tbody>
      {/* El pie suma lo que se está viendo, no todo el histórico: con un filtro aplicado,
          el número que interesa es el de lo filtrado. Los traspasos no entran — mueven
          dinero entre cuentas propias y sumarlos falsearía el neto. */}
      {filasOrdenadas.length > 0 && (
        <tfoot>
          <tr className="border-t-2 border-border-strong bg-chip/60">
            <td colSpan={4} className="px-4 py-3 text-[13px] font-semibold text-ink">
              Neto de {filasOrdenadas.length} {filasOrdenadas.length === 1 ? "movimiento" : "movimientos"}
              {hayTraspasos && <span className="ml-1.5 font-normal text-ink-tertiary">(sin contar traspasos)</span>}
            </td>
            <td className="whitespace-nowrap px-4 py-3 text-right font-sora text-base font-bold tabular-nums text-ink">
              {neto >= 0 ? "+" : "−"}
              {formatEUR(Math.abs(neto))}
            </td>
            <td />
          </tr>
        </tfoot>
      )}
    </table>
    </div>
  );
}

function FilaMovimiento({
  mov,
  categoriasOrdenadas,
  formatEUR,
  inversiones,
  actualizarCategoriaMovimiento,
  vincularComoTraspaso,
  eliminarTraspaso,
  eliminarMovimiento,
  asignarMovimientoAInversion,
}: {
  mov: MovimientoFila;
  categoriasOrdenadas: CategoriaJerarquica[];
  formatEUR: (v: number) => string;
  inversiones: InversionOption[];
  actualizarCategoriaMovimiento: (formData: FormData) => void;
  vincularComoTraspaso: (formData: FormData) => void;
  eliminarTraspaso: (formData: FormData) => void;
  eliminarMovimiento: (formData: FormData) => void;
  asignarMovimientoAInversion: (formData: FormData) => void;
}) {
  const esTraspaso = mov.tipo === "traspaso";

  return (
    <tr className="group border-t border-border">
      <td className="whitespace-nowrap px-4 py-3.5 text-ink-tertiary">{formatFecha(mov.fecha)}</td>
      <td className="whitespace-nowrap px-4 py-3.5 text-ink-tertiary">
        {mov.cuentas ? `${mov.cuentas.banco_nombre} — ${mov.cuentas.nombre}` : "—"}
      </td>
      <td className="px-4 py-3.5 text-ink">
        {mov.descripcion}
        {esTraspaso && (
          <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">
            Traspaso
          </span>
        )}
      </td>
      <td className="px-4 py-3.5">
        {/* Un traspaso también lleva categoría: cuando se miran los informes de una sola de
            las dos cuentas, esa pata cuenta como gasto o ingreso real y aparece en ella. */}
        <CategoriaCelda
          movimientoId={mov.id}
          descripcion={mov.descripcion}
          categoriaId={mov.categoria_id}
          categorias={categoriasOrdenadas}
          action={actualizarCategoriaMovimiento}
          sugeridaId={mov.sugeridaId}
        />
        {!esTraspaso && (
          <MarcarComoTraspaso
            movimientoId={mov.id}
            candidatos={mov.candidatosTraspaso.map((c) => ({
              id: c.id,
              label: `${c.cuenta ? `${c.cuenta.banco_nombre} — ${c.cuenta.nombre}` : "?"} · ${c.fecha} · ${formatEUR(c.importe)}`,
            }))}
            action={vincularComoTraspaso}
          />
        )}
        {mov.esAporteInversion && (
          <AsignarAInversion
            movimientoId={mov.id}
            inversiones={inversiones}
            asignada={mov.inversionAsignada ?? null}
            action={asignarMovimientoAInversion}
          />
        )}
      </td>
      {/* El color deja de marcar el signo: con decenas de intereses de 0,02 € en verde, el
          verde acababa significando "hay una fila aquí" en vez de "esto es bueno". El signo
          lo lleva el propio número y el peso lo da la tipografía (auditoría, tanda 11). El
          acento se reserva para los traspasos, que sí son una categoría aparte. */}
      <td
        className={`whitespace-nowrap px-4 py-3.5 text-right text-[15px] font-semibold tabular-nums ${
          esTraspaso ? "text-accent" : "text-ink"
        }`}
      >
        {Number(mov.importe) > 0 && !esTraspaso ? "+" : ""}
        {formatEUR(Number(mov.importe))}
      </td>
      {/* Siempre visible en móvil, donde no hay ratón con el que señalar; en escritorio
          aparece al pasar por encima. "Eliminar" se repetía 98 veces con peso completo:
          la acción más destructiva de la pantalla era también la palabra más frecuente. */}
      <td className="px-4 py-3.5 text-right opacity-100 transition-opacity focus-within:opacity-100 md:opacity-0 md:group-hover:opacity-100">
        {esTraspaso ? (
          <ConfirmForm
            action={eliminarTraspaso}
            mensaje={
              mov.tipo_original
                ? "¿Seguro que quieres desvincular este traspaso? Los dos movimientos volverán a su tipo original (ingreso/gasto), conservando su categoría; los saldos no cambian."
                : "¿Seguro que quieres eliminar este traspaso? Se eliminarán los dos movimientos enlazados (origen y destino) y se revertirán ambos saldos."
            }
          >
            <input type="hidden" name="traspaso_grupo_id" value={mov.traspaso_grupo_id ?? ""} />
            <button className="text-[13px] font-semibold text-faint hover:text-danger" type="submit">
              {mov.tipo_original ? "Desvincular" : "Eliminar"}
            </button>
          </ConfirmForm>
        ) : (
          <ConfirmForm
            action={eliminarMovimiento}
            mensaje={`¿Seguro que quieres eliminar el movimiento "${mov.descripcion}" (${formatEUR(Number(mov.importe))})?`}
          >
            <input type="hidden" name="id" value={mov.id} />
            <button className="text-[13px] font-semibold text-faint hover:text-danger" type="submit">
              Eliminar
            </button>
          </ConfirmForm>
        )}
      </td>
    </tr>
  );
}
