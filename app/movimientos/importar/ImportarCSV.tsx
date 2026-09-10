"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { parseCSV, detectarDelimitador, detectarFilaCabecera } from "@/lib/csv";
import { parseXLSX } from "@/lib/xlsx";
import {
  parseFechaImportada,
  parseImporteImportado,
  combinarImporteConComisionYRetencion,
  detectarFormatoFecha,
  detectarSeparadorDecimal,
  type FormatoFecha,
} from "@/lib/importarCsv";
import { sugerirCategoria, type ReglaCategorizacion } from "@/lib/categorizacion";
import type { CategoriaJerarquica } from "@/lib/categorias";
import { importeEstimado, previstosCoincidentes, type MovimientoPrevisto } from "@/lib/prevision";
import { importarMovimientos, importarTraspasos, type FilaImportar } from "./actions";
import { formatMoneda } from "@/lib/formato";

type Cuenta = { id: string; nombre: string; banco_nombre: string; iban: string | null };
type MovimientoExistente = { cuenta_id: string; fecha: string; importe: number; descripcion: string };
type FilaPrevia = FilaImportar & {
  original: string;
  valida: boolean;
  motivoInvalido: string | null;
  esTraspaso: boolean;
  cuentaContraparteId: string | null;
  esDuplicado: boolean;
  incluirDuplicado: boolean;
  omitidaPorFechaCorte: boolean;
};

function claveMovimiento(cuentaId: string, fecha: string, importe: number, descripcion: string): string {
  return `${cuentaId}|${fecha}|${importe.toFixed(2)}|${descripcion.trim().toLowerCase()}`;
}

const DELIMITADORES = [
  { value: ",", label: "Coma (,)" },
  { value: ";", label: "Punto y coma (;)" },
  { value: "\t", label: "Tabulador" },
];

const FORMATOS_FECHA: { value: FormatoFecha; label: string }[] = [
  { value: "DMY", label: "DD/MM/AAAA" },
  { value: "YMD", label: "AAAA-MM-DD" },
  { value: "MDY", label: "MM/DD/AAAA" },
];

function adivinarColumna(cabeceras: string[], palabras: string[]): string {
  const exacta = cabeceras.find((c) => palabras.includes(c.toLowerCase()));
  if (exacta) return exacta;
  return cabeceras.find((c) => palabras.some((p) => c.toLowerCase().includes(p))) ?? "";
}

function normalizarIban(valor: string): string {
  return valor.replace(/\s+/g, "").toUpperCase();
}

const formatFecha = (v: string) => new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(new Date(v));

function diaSiguiente(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function ImportarCSV({
  cuentas,
  categorias,
  reglas,
  existentes,
  previstos,
  moneda,
}: {
  cuentas: Cuenta[];
  categorias: CategoriaJerarquica[];
  reglas: ReglaCategorizacion[];
  existentes: MovimientoExistente[];
  previstos: MovimientoPrevisto[];
  moneda: string;
}) {
  const router = useRouter();
  const formatEUR = (v: number) => formatMoneda(v, moneda);

  const firmasExistentes = useMemo(
    () => new Set(existentes.map((m) => claveMovimiento(m.cuenta_id, m.fecha, Number(m.importe), m.descripcion))),
    [existentes]
  );

  const ultimaFechaPorCuenta = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const m of existentes) {
      const actual = mapa.get(m.cuenta_id);
      if (!actual || m.fecha > actual) mapa.set(m.cuenta_id, m.fecha);
    }
    return mapa;
  }, [existentes]);

  const [paso, setPaso] = useState<"subir" | "mapear" | "previsualizar">("subir");
  const [cuentaId, setCuentaIdState] = useState(cuentas[0]?.id ?? "");
  const [fechaCorte, setFechaCorte] = useState(() => {
    const ultima = ultimaFechaPorCuenta.get(cuentas[0]?.id ?? "");
    return ultima ? diaSiguiente(ultima) : "";
  });

  function setCuentaId(id: string) {
    setCuentaIdState(id);
    const ultima = ultimaFechaPorCuenta.get(id);
    setFechaCorte(ultima ? diaSiguiente(ultima) : "");
  }
  const [nombreArchivo, setNombreArchivo] = useState("");
  const [modoArchivo, setModoArchivo] = useState<"csv" | "xlsx">("csv");
  const [textoOriginal, setTextoOriginal] = useState("");
  const [filasCrudas, setFilasCrudas] = useState<string[][]>([]);
  const [delimitador, setDelimitador] = useState(",");
  const [filaCabecera, setFilaCabecera] = useState(1);

  const [colFecha, setColFecha] = useState("");
  const [colDescripcion, setColDescripcion] = useState("");
  const [modoImporte, setModoImporte] = useState<"unico" | "cargoAbono">("unico");
  const [colImporte, setColImporte] = useState("");
  const [colCargo, setColCargo] = useState("");
  const [colAbono, setColAbono] = useState("");
  const [colComision, setColComision] = useState("");
  const [colRetencion, setColRetencion] = useState("");
  const [colIbanContraparte, setColIbanContraparte] = useState("");
  const [formatoFecha, setFormatoFecha] = useState<FormatoFecha>("DMY");
  const [separadorDecimal, setSeparadorDecimal] = useState<"," | ".">(",");
  const [colFiltro, setColFiltro] = useState("");
  const [valorFiltro, setValorFiltro] = useState("");

  const [filasPreview, setFilasPreview] = useState<FilaPrevia[]>([]);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  const filasCSV = useMemo(() => {
    if (modoArchivo === "xlsx") return filasCrudas;
    return parseCSV(textoOriginal, delimitador);
  }, [modoArchivo, filasCrudas, textoOriginal, delimitador]);

  const cabeceras = filasCSV[filaCabecera - 1] ?? [];
  const filasDatos = filasCSV.slice(filaCabecera);
  const cuentasContraparte = cuentas.filter((c) => c.id !== cuentaId);

  const idxFiltro = cabeceras.indexOf(colFiltro);
  const valoresColumnaFiltro = useMemo(() => {
    if (idxFiltro < 0) return [];
    const valores = new Set<string>();
    for (const fila of filasDatos) {
      const v = fila[idxFiltro];
      if (v) valores.add(v);
    }
    return Array.from(valores).sort();
  }, [filasDatos, idxFiltro]);

  const filasDatosFiltradas = useMemo(() => {
    if (!colFiltro || !valorFiltro || idxFiltro < 0) return filasDatos;
    return filasDatos.filter((fila) => fila[idxFiltro] === valorFiltro);
  }, [filasDatos, colFiltro, valorFiltro, idxFiltro]);

  function onCambiarColFiltro(col: string) {
    setColFiltro(col);
    setValorFiltro("");
  }

  function aplicarGuesses(cab: string[], datos: string[][]) {
    const colFechaDetectada = adivinarColumna(cab, ["fecha", "date"]);
    const colImporteDetectada = adivinarColumna(cab, ["importe", "cantidad", "amount"]);
    const colCargoDetectada = adivinarColumna(cab, ["cargo", "debe", "debit"]);
    const colAbonoDetectada = adivinarColumna(cab, ["abono", "haber", "credit"]);
    const colComisionDetectada = adivinarColumna(cab, ["fee", "comision", "comisión"]);
    const colRetencionDetectada = adivinarColumna(cab, ["tax", "retencion", "retención"]);
    const colIbanDetectada = adivinarColumna(cab, [
      "iban",
      "counterparty_iban",
      "cuenta_contraparte",
      "iban_contrapartida",
    ]);

    setColFecha(colFechaDetectada);
    setColDescripcion(adivinarColumna(cab, ["concepto", "descrip", "detalle", "movimiento"]));
    setColImporte(colImporteDetectada);
    setColCargo(colCargoDetectada);
    setColAbono(colAbonoDetectada);
    setColComision(colComisionDetectada);
    setColRetencion(colRetencionDetectada);
    setColIbanContraparte(colIbanDetectada);

    const idxFecha = cab.indexOf(colFechaDetectada);
    if (idxFecha >= 0) {
      const muestraFecha = datos.map((f) => f[idxFecha]).find((v) => v);
      if (muestraFecha) {
        const formatoDetectado = detectarFormatoFecha(muestraFecha);
        if (formatoDetectado) setFormatoFecha(formatoDetectado);
      }
    }

    const colImporteParaMuestra = colImporteDetectada || colCargoDetectada || colAbonoDetectada;
    const idxImporte = cab.indexOf(colImporteParaMuestra);
    if (idxImporte >= 0) {
      const muestrasImporte = datos.map((f) => f[idxImporte]).filter((v): v is string => Boolean(v));
      if (muestrasImporte.length > 0) {
        setSeparadorDecimal(detectarSeparadorDecimal(muestrasImporte));
      }
    }
  }

  async function onArchivoSeleccionado(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const esXlsx = file.name.toLowerCase().endsWith(".xlsx");
    let grid: string[][];

    if (esXlsx) {
      const buffer = await file.arrayBuffer();
      grid = parseXLSX(buffer);
      setModoArchivo("xlsx");
      setFilasCrudas(grid);
      setTextoOriginal("");
    } else {
      const texto = await file.text();
      const primeraLinea = texto.split(/\r?\n/)[0] ?? "";
      const delim = detectarDelimitador(primeraLinea);
      grid = parseCSV(texto, delim);
      setModoArchivo("csv");
      setTextoOriginal(texto);
      setDelimitador(delim);
      setFilasCrudas([]);
    }

    const filaDetectada = detectarFilaCabecera(grid);
    setFilaCabecera(filaDetectada);

    const cab = grid[filaDetectada - 1] ?? [];
    const datos = grid.slice(filaDetectada, filaDetectada + 20);
    aplicarGuesses(cab, datos);
    setColFiltro("");
    setValorFiltro("");

    setNombreArchivo(file.name);
    setResultado(null);
    setPaso("mapear");
  }

  function onCambiarFilaCabecera(valor: number) {
    setFilaCabecera(valor);
    const cab = filasCSV[valor - 1] ?? [];
    const datos = filasCSV.slice(valor, valor + 20);
    aplicarGuesses(cab, datos);
    setColFiltro("");
    setValorFiltro("");
  }

  // Vuelve a sugerir formato de fecha / separador decimal cuando el usuario cambia
  // manualmente qué columna corresponde a cada cosa (cada banco exporta distinto,
  // así que el mapeo puede no coincidir con la primera suposición automática).
  function muestrasColumna(nombreColumna: string): string[] {
    const idx = cabeceras.indexOf(nombreColumna);
    if (idx < 0) return [];
    return filasDatos
      .slice(0, 20)
      .map((f) => f[idx])
      .filter((v): v is string => Boolean(v));
  }

  function onCambiarColFecha(col: string) {
    setColFecha(col);
    const muestra = muestrasColumna(col)[0];
    if (muestra) {
      const formato = detectarFormatoFecha(muestra);
      if (formato) setFormatoFecha(formato);
    }
  }

  function onCambiarColImporte(col: string) {
    setColImporte(col);
    const muestras = muestrasColumna(col);
    if (muestras.length > 0) setSeparadorDecimal(detectarSeparadorDecimal(muestras));
  }

  function onCambiarColCargo(col: string) {
    setColCargo(col);
    const muestras = muestrasColumna(col);
    if (muestras.length > 0) setSeparadorDecimal(detectarSeparadorDecimal(muestras));
  }

  function onCambiarColAbono(col: string) {
    setColAbono(col);
    const muestras = muestrasColumna(col);
    if (muestras.length > 0) setSeparadorDecimal(detectarSeparadorDecimal(muestras));
  }

  function calcularPreview() {
    const idxFecha = cabeceras.indexOf(colFecha);
    const idxDescripcion = cabeceras.indexOf(colDescripcion);
    const idxImporte = cabeceras.indexOf(colImporte);
    const idxCargo = cabeceras.indexOf(colCargo);
    const idxAbono = cabeceras.indexOf(colAbono);
    const idxComision = cabeceras.indexOf(colComision);
    const idxRetencion = cabeceras.indexOf(colRetencion);
    const idxIban = cabeceras.indexOf(colIbanContraparte);

    const ibansPropios = new Map(
      cuentasContraparte.filter((c) => c.iban).map((c) => [normalizarIban(c.iban!), c.id])
    );

    const filas: FilaPrevia[] = filasDatosFiltradas.map((fila) => {
      const fecha = idxFecha >= 0 ? parseFechaImportada(fila[idxFecha] ?? "", formatoFecha) : null;
      const descripcion = (idxDescripcion >= 0 ? fila[idxDescripcion] : "") ?? "";

      let importe: number | null = null;
      if (modoImporte === "unico") {
        importe = idxImporte >= 0 ? parseImporteImportado(fila[idxImporte] ?? "", separadorDecimal) : null;
      } else {
        const cargo = idxCargo >= 0 ? parseImporteImportado(fila[idxCargo] ?? "", separadorDecimal) : null;
        const abono = idxAbono >= 0 ? parseImporteImportado(fila[idxAbono] ?? "", separadorDecimal) : null;
        if (abono) importe = Math.abs(abono);
        else if (cargo) importe = -Math.abs(cargo);
      }

      if (importe !== null) {
        importe = combinarImporteConComisionYRetencion(
          importe,
          idxComision >= 0 ? fila[idxComision] : undefined,
          idxRetencion >= 0 ? fila[idxRetencion] : undefined,
          separadorDecimal
        );
      }

      const valida = fecha !== null && descripcion !== "" && importe !== null && importe !== 0;

      let motivoInvalido: string | null = null;
      if (!valida) {
        const motivos: string[] = [];
        if (fecha === null) motivos.push("fecha no reconocida");
        if (descripcion === "") motivos.push("descripción vacía");
        if (importe === null) motivos.push("importe no reconocido");
        else if (importe === 0) motivos.push("importe es cero");
        motivoInvalido = motivos.join(", ");
      }

      const tipo: "ingreso" | "gasto" = (importe ?? 0) >= 0 ? "ingreso" : "gasto";
      const sugerida = valida ? sugerirCategoria(descripcion, reglas) : null;
      const categoria_id = sugerida && categorias.some((c) => c.id === sugerida) ? sugerida : null;

      let esTraspaso = false;
      let cuentaContraparteId: string | null = null;
      if (valida && idxIban >= 0) {
        const ibanFila = normalizarIban(fila[idxIban] ?? "");
        const contraparteId = ibanFila ? ibansPropios.get(ibanFila) : undefined;
        if (contraparteId) {
          esTraspaso = true;
          cuentaContraparteId = contraparteId;
        }
      }

      const esDuplicado =
        valida && firmasExistentes.has(claveMovimiento(cuentaId, fecha ?? "", importe ?? 0, descripcion));
      const omitidaPorFechaCorte = valida && fechaCorte !== "" && (fecha ?? "") < fechaCorte;

      return {
        fecha: fecha ?? "",
        descripcion,
        importe: importe ?? 0,
        tipo,
        categoria_id,
        previstoId: null,
        original: fila.join(" | "),
        valida,
        motivoInvalido,
        esTraspaso,
        cuentaContraparteId,
        esDuplicado,
        incluirDuplicado: false,
        omitidaPorFechaCorte,
      };
    });

    setFilasPreview(filas);
    setPaso("previsualizar");
  }

  function actualizarCategoria(index: number, categoriaId: string) {
    setFilasPreview((prev) =>
      prev.map((f, i) => (i === index ? { ...f, categoria_id: categoriaId || null, previstoId: null } : f))
    );
  }

  function actualizarPrevisto(index: number, previstoId: string) {
    setFilasPreview((prev) => prev.map((f, i) => (i === index ? { ...f, previstoId: previstoId || null } : f)));
  }

  function toggleTraspaso(index: number, esTraspaso: boolean) {
    setFilasPreview((prev) =>
      prev.map((f, i) =>
        i === index
          ? {
              ...f,
              esTraspaso,
              cuentaContraparteId: esTraspaso ? f.cuentaContraparteId ?? cuentasContraparte[0]?.id ?? null : null,
            }
          : f
      )
    );
  }

  function actualizarContraparte(index: number, cuentaContraparteId: string) {
    setFilasPreview((prev) =>
      prev.map((f, i) => (i === index ? { ...f, cuentaContraparteId: cuentaContraparteId || null } : f))
    );
  }

  function toggleIncluirDuplicado(index: number, incluir: boolean) {
    setFilasPreview((prev) => prev.map((f, i) => (i === index ? { ...f, incluirDuplicado: incluir } : f)));
  }

  async function confirmarImportacion() {
    setImportando(true);
    setResultado(null);

    const filasValidas = filasPreview.filter(
      (f) => f.valida && !f.omitidaPorFechaCorte && (!f.esDuplicado || f.incluirDuplicado)
    );
    const filasTraspaso = filasValidas.filter((f) => f.esTraspaso && f.cuentaContraparteId);
    const filasNormales = filasValidas.filter((f) => !(f.esTraspaso && f.cuentaContraparteId));

    const [respuestaMovimientos, respuestaTraspasos] = await Promise.all([
      filasNormales.length > 0
        ? importarMovimientos(
            cuentaId,
            filasNormales.map(({ fecha, descripcion, importe, tipo, categoria_id, previstoId }) => ({
              fecha,
              descripcion,
              importe,
              tipo,
              categoria_id,
              previstoId,
            }))
          )
        : Promise.resolve({ ok: true as const, importados: 0, conciliados: 0 }),
      filasTraspaso.length > 0
        ? importarTraspasos(
            cuentaId,
            filasTraspaso.map((f) => ({
              fecha: f.fecha,
              descripcion: f.descripcion,
              importe: f.importe,
              cuentaContraparteId: f.cuentaContraparteId as string,
            }))
          )
        : Promise.resolve({ ok: true as const, importados: 0 }),
    ]);

    setImportando(false);

    if (respuestaMovimientos.ok && respuestaTraspasos.ok) {
      const partes = [];
      if (respuestaMovimientos.importados > 0) partes.push(`${respuestaMovimientos.importados} movimientos`);
      if (respuestaTraspasos.importados > 0) partes.push(`${respuestaTraspasos.importados} traspasos`);
      const conciliados = "conciliados" in respuestaMovimientos ? respuestaMovimientos.conciliados : 0;
      const sufijo = conciliados > 0 ? ` (${conciliados} conciliados con su previsión)` : "";
      setResultado(`Se han importado ${partes.join(" y ")} correctamente${sufijo}.`);
      setPaso("subir");
      setNombreArchivo("");
      setTextoOriginal("");
      setFilasCrudas([]);
      setFilasPreview([]);
      router.refresh();
    } else {
      const error = !respuestaMovimientos.ok ? respuestaMovimientos.error : (respuestaTraspasos as { error: string }).error;
      setResultado(`Error al importar: ${error}`);
    }
  }

  const filasValidas = filasPreview.filter((f) => f.valida);
  const filasInvalidasDetalle = filasPreview.filter((f) => !f.valida);
  const filasInvalidas = filasInvalidasDetalle.length;
  const filasOmitidasPorFecha = filasValidas.filter((f) => f.omitidaPorFechaCorte);
  const filasDentroDeRango = filasValidas.filter((f) => !f.omitidaPorFechaCorte);
  const filasDuplicadasSinConfirmar = filasDentroDeRango.filter((f) => f.esDuplicado && !f.incluirDuplicado);
  const filasAImportar = filasDentroDeRango.filter((f) => !f.esDuplicado || f.incluirDuplicado);
  const totalImporte = filasAImportar.reduce((suma, f) => suma + f.importe, 0);
  const previewFilasCrudas = filasCSV.slice(0, 8);

  return (
    <div className="space-y-6">
      {resultado && (
        <div
          className={`rounded-md border px-4 py-3 text-sm ${
            resultado.startsWith("Error")
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {resultado}
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
        <div>
          <label className="block text-xs text-slate-500">Cuenta destino</label>
          <select
            value={cuentaId}
            onChange={(e) => setCuentaId(e.target.value)}
            className="mt-1 w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            {cuentas.map((cuenta) => (
              <option key={cuenta.id} value={cuenta.id}>
                {cuenta.banco_nombre} — {cuenta.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-slate-500">Archivo CSV o Excel</label>
          <input
            type="file"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={onArchivoSeleccionado}
            className="mt-1 block text-sm"
          />
          {nombreArchivo && <p className="mt-1 text-xs text-slate-400">Archivo: {nombreArchivo}</p>}
        </div>
      </div>

      {paso !== "subir" && filasCSV.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
          <h2 className="text-sm font-medium text-slate-700">Mapeo de columnas</h2>
          <p className="text-xs text-slate-400">
            Cada banco exporta el archivo con sus propias columnas (y a veces con filas de texto antes
            de la tabla) — indica aquí a qué corresponde cada cosa.
          </p>

          <div className="max-h-40 overflow-y-auto overflow-x-auto rounded-md border border-slate-100 text-xs">
            <table className="w-full">
              <tbody>
                {previewFilasCrudas.map((fila, i) => (
                  <tr
                    key={i}
                    className={`border-t border-slate-100 first:border-t-0 ${
                      i === filaCabecera - 1 ? "bg-amber-50 font-medium" : ""
                    }`}
                  >
                    <td className="px-2 py-1 text-slate-400">{i + 1}</td>
                    {fila.slice(0, 8).map((v, j) => (
                      <td key={j} className="whitespace-nowrap px-2 py-1">
                        {v || "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs text-slate-500">Fila de cabecera</label>
              <input
                type="number"
                min={1}
                max={filasCSV.length}
                value={filaCabecera}
                onChange={(e) => onCambiarFilaCabecera(Math.max(1, Number(e.target.value) || 1))}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-slate-400">Resaltada arriba. Súbela si el archivo trae texto antes.</p>
            </div>
            <div>
              <label className="block text-xs text-slate-500">Fecha de corte (opcional)</label>
              <input
                type="date"
                value={fechaCorte}
                onChange={(e) => setFechaCorte(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-slate-400">
                Se ignora todo lo anterior a esta fecha, aunque el archivo lo incluya (evita reimportar
                movimientos antiguos o que borraste a propósito). Por defecto, el día siguiente al último
                movimiento que ya tienes en esta cuenta.
              </p>
            </div>
            {modoArchivo === "csv" && (
              <div>
                <label className="block text-xs text-slate-500">Delimitador</label>
                <select
                  value={delimitador}
                  onChange={(e) => setDelimitador(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  {DELIMITADORES.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs text-slate-500">Columna fecha</label>
              <select
                value={colFecha}
                onChange={(e) => onCambiarColFecha(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">— Selecciona —</option>
                {cabeceras.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500">Formato de fecha</label>
              <select
                value={formatoFecha}
                onChange={(e) => setFormatoFecha(e.target.value as FormatoFecha)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                {FORMATOS_FECHA.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500">Columna descripción</label>
              <select
                value={colDescripcion}
                onChange={(e) => setColDescripcion(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">— Selecciona —</option>
                {cabeceras.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500">Separador decimal</label>
              <select
                value={separadorDecimal}
                onChange={(e) => setSeparadorDecimal(e.target.value as "," | ".")}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value=",">Coma (1.234,56)</option>
                <option value=".">Punto (1234.56)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500">
                Columna IBAN contraparte (opcional)
              </label>
              <select
                value={colIbanContraparte}
                onChange={(e) => setColIbanContraparte(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Sin usar</option>
                {cabeceras.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-400">
                Si coincide con el IBAN de otra de tus cuentas, se marcará como traspaso.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 rounded-md border border-slate-100 bg-slate-50 p-4">
            <div>
              <label className="block text-xs text-slate-500">Filtrar por columna (opcional)</label>
              <select
                value={colFiltro}
                onChange={(e) => onCambiarColFiltro(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Sin filtrar (usar todas las filas)</option>
                {cabeceras.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-400">
                Útil si el archivo mezcla varias cuentas en uno (p. ej. Revolut exporta Actual, Ahorros y
                Depósito juntos, distinguidas por una columna "Producto"): elige aquí esa columna.
              </p>
            </div>
            {colFiltro && (
              <div>
                <label className="block text-xs text-slate-500">Valor a importar</label>
                <select
                  value={valorFiltro}
                  onChange={(e) => setValorFiltro(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">— Selecciona un valor —</option>
                  {valoresColumnaFiltro.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-400">
                  Solo se leerán las filas donde &quot;{colFiltro}&quot; sea exactamente este valor
                  {valorFiltro ? ` (${filasDatosFiltradas.length} de ${filasDatos.length} filas)` : ""}. Repite
                  la importación con otro valor para cada una de tus otras cuentas de este mismo archivo.
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs text-slate-500">Cómo viene el importe</label>
            <div className="mt-1 flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-1.5">
                <input type="radio" checked={modoImporte === "unico"} onChange={() => setModoImporte("unico")} />
                Una columna (positivo/negativo)
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={modoImporte === "cargoAbono"}
                  onChange={() => setModoImporte("cargoAbono")}
                />
                Columnas separadas de cargo y abono
              </label>
            </div>
          </div>

          {modoImporte === "unico" ? (
            <div className="max-w-sm">
              <label className="block text-xs text-slate-500">Columna importe</label>
              <select
                value={colImporte}
                onChange={(e) => onCambiarColImporte(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">— Selecciona —</option>
                {cabeceras.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs text-slate-500">Columna cargo (gastos)</label>
                <select
                  value={colCargo}
                  onChange={(e) => onCambiarColCargo(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">— Selecciona —</option>
                  {cabeceras.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500">Columna abono (ingresos)</label>
                <select
                  value={colAbono}
                  onChange={(e) => onCambiarColAbono(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">— Selecciona —</option>
                  {cabeceras.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs text-slate-500">Columna comisión (opcional)</label>
              <select
                value={colComision}
                onChange={(e) => setColComision(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Sin usar</option>
                {cabeceras.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-400">
                Si el archivo trae la comisión en una columna aparte (ej. "fee"), se suma al importe.
              </p>
            </div>
            <div>
              <label className="block text-xs text-slate-500">Columna retención fiscal (opcional)</label>
              <select
                value={colRetencion}
                onChange={(e) => setColRetencion(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Sin usar</option>
                {cabeceras.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-400">
                Si el archivo trae la retención fiscal en una columna aparte (ej. "tax"), se suma al importe.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={calcularPreview}
            disabled={
              !colFecha ||
              !colDescripcion ||
              (modoImporte === "unico" ? !colImporte : !colCargo && !colAbono) ||
              (colFiltro !== "" && valorFiltro === "")
            }
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40"
          >
            Previsualizar
          </button>
        </div>
      )}

      {paso === "previsualizar" && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-slate-700">
              Previsualización — {filasAImportar.length} movimientos listos para importar
            </h2>
            <p className="text-sm font-medium">Total: {formatEUR(totalImporte)}</p>
          </div>

          {filasInvalidas > 0 && (
            <details className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              <summary className="cursor-pointer font-medium">
                {filasInvalidas} filas no se han podido leer y se omitirán. Ver detalle.
              </summary>
              <p className="mt-2 text-amber-600">
                Revisa el mapeo de columnas si el número es mayor de lo esperado.
              </p>
              <table className="mt-2 w-full text-left">
                <thead>
                  <tr className="text-amber-500">
                    <th className="pr-3 py-1 font-medium">Fila</th>
                    <th className="pr-3 py-1 font-medium">Motivo</th>
                    <th className="py-1 font-medium">Contenido original</th>
                  </tr>
                </thead>
                <tbody>
                  {filasInvalidasDetalle.map((fila, i) => (
                    <tr key={i} className="border-t border-amber-100 align-top">
                      <td className="pr-3 py-1 whitespace-nowrap text-amber-500">
                        {filasPreview.indexOf(fila) + 1}
                      </td>
                      <td className="pr-3 py-1 whitespace-nowrap">{fila.motivoInvalido}</td>
                      <td className="py-1 font-mono text-amber-700">{fila.original}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}

          {filasOmitidasPorFecha.length > 0 && (
            <p className="text-xs text-slate-400">
              {filasOmitidasPorFecha.length} filas son anteriores a la fecha de corte ({formatFecha(fechaCorte)})
              y se omiten.
            </p>
          )}

          {filasDuplicadasSinConfirmar.length > 0 && (
            <p className="text-xs text-amber-600">
              {filasDuplicadasSinConfirmar.length} filas parecen ya existir en esta cuenta (misma fecha,
              importe y descripción) y se omitirán para no duplicarlas. Márcalas como "Importar de todas
              formas" si en realidad son movimientos distintos.
            </p>
          )}

          <div className="max-h-[28rem] overflow-y-auto overflow-x-auto rounded-md border border-slate-100">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Fecha</th>
                  <th className="px-3 py-2 font-medium">Descripción</th>
                  <th className="px-3 py-2 font-medium text-right">Importe</th>
                  <th className="px-3 py-2 font-medium">Categoría / Traspaso</th>
                </tr>
              </thead>
              <tbody>
                {filasPreview.map((fila, index) => {
                  const omitidaPorDuplicado = fila.esDuplicado && !fila.incluirDuplicado;
                  return (
                  <tr
                    key={index}
                    className={`border-t border-slate-100 ${
                      !fila.valida || omitidaPorDuplicado || fila.omitidaPorFechaCorte ? "opacity-40" : ""
                    }`}
                  >
                    <td className="px-3 py-2 whitespace-nowrap text-slate-500">
                      {fila.valida ? formatFecha(fila.fecha) : `Sin leer (${fila.original})`}
                    </td>
                    <td className="px-3 py-2">
                      {fila.descripcion || "—"}
                      {fila.esDuplicado && (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                          Posible duplicado
                        </span>
                      )}
                      {fila.omitidaPorFechaCorte && (
                        <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                          Anterior a la fecha de corte
                        </span>
                      )}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-medium ${
                        fila.importe < 0 ? "text-slate-900" : "text-emerald-600"
                      }`}
                    >
                      {fila.valida ? formatEUR(fila.importe) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {fila.valida && (
                        <div className="space-y-1">
                          {fila.esDuplicado && (
                            <label className="flex items-center gap-1.5 text-xs text-amber-700">
                              <input
                                type="checkbox"
                                checked={fila.incluirDuplicado}
                                onChange={(e) => toggleIncluirDuplicado(index, e.target.checked)}
                              />
                              Importar de todas formas
                            </label>
                          )}
                          <label className="flex items-center gap-1.5 text-xs text-sky-700">
                            <input
                              type="checkbox"
                              checked={fila.esTraspaso}
                              onChange={(e) => toggleTraspaso(index, e.target.checked)}
                              disabled={cuentasContraparte.length === 0}
                            />
                            Es traspaso entre mis cuentas
                          </label>
                          {fila.esTraspaso ? (
                            <select
                              value={fila.cuentaContraparteId ?? ""}
                              onChange={(e) => actualizarContraparte(index, e.target.value)}
                              className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                            >
                              {cuentasContraparte.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.banco_nombre} — {c.nombre}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <>
                              <select
                                value={fila.categoria_id ?? ""}
                                onChange={(e) => actualizarCategoria(index, e.target.value)}
                                className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                              >
                                <option value="">Sin categoría</option>
                                {categorias.map((cat) => (
                                  <option key={cat.id} value={cat.id}>
                                    {cat.label}
                                  </option>
                                ))}
                              </select>
                              {(() => {
                                const candidatos = previstosCoincidentes(
                                  {
                                    fecha: fila.fecha,
                                    tipo: fila.tipo,
                                    categoria_id: fila.categoria_id,
                                    importe: fila.importe,
                                  },
                                  previstos
                                );
                                if (candidatos.length === 0) return null;
                                return (
                                  <select
                                    value={fila.previstoId ?? ""}
                                    onChange={(e) => actualizarPrevisto(index, e.target.value)}
                                    className="w-full rounded-md border border-sky-300 bg-sky-50 px-2 py-1 text-xs text-sky-700"
                                  >
                                    <option value="">¿Es una previsión? — no vincular</option>
                                    {candidatos.map((p) => (
                                      <option key={p.id} value={p.id}>
                                        {p.descripcion} ({formatEUR(importeEstimado(p))})
                                      </option>
                                    ))}
                                  </select>
                                );
                              })()}
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setPaso("mapear")}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Volver a mapear
            </button>
            <button
              type="button"
              onClick={confirmarImportacion}
              disabled={importando || filasAImportar.length === 0}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40"
            >
              {importando ? "Importando…" : `Confirmar importación (${filasAImportar.length})`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
