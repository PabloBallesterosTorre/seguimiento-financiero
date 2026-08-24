"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { parseCSV, detectarDelimitador } from "@/lib/csv";
import { parseFechaImportada, parseImporteImportado, type FormatoFecha } from "@/lib/importarCsv";
import { sugerirCategoria, type ReglaCategorizacion } from "@/lib/categorizacion";
import { importarMovimientos, type FilaImportar } from "./actions";

type Cuenta = { id: string; nombre: string; banco_nombre: string };
type Categoria = { id: string; nombre: string };
type FilaPrevia = FilaImportar & { original: string; valida: boolean };

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
  return cabeceras.find((c) => palabras.some((p) => c.toLowerCase().includes(p))) ?? "";
}

const formatEUR = (v: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(v);
const formatFecha = (v: string) => new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(new Date(v));

export function ImportarCSV({
  cuentas,
  categoriasGasto,
  categoriasIngreso,
  reglas,
}: {
  cuentas: Cuenta[];
  categoriasGasto: Categoria[];
  categoriasIngreso: Categoria[];
  reglas: ReglaCategorizacion[];
}) {
  const router = useRouter();

  const [paso, setPaso] = useState<"subir" | "mapear" | "previsualizar">("subir");
  const [cuentaId, setCuentaId] = useState(cuentas[0]?.id ?? "");
  const [nombreArchivo, setNombreArchivo] = useState("");
  const [textoOriginal, setTextoOriginal] = useState("");
  const [delimitador, setDelimitador] = useState(",");

  const [colFecha, setColFecha] = useState("");
  const [colDescripcion, setColDescripcion] = useState("");
  const [modoImporte, setModoImporte] = useState<"unico" | "cargoAbono">("unico");
  const [colImporte, setColImporte] = useState("");
  const [colCargo, setColCargo] = useState("");
  const [colAbono, setColAbono] = useState("");
  const [formatoFecha, setFormatoFecha] = useState<FormatoFecha>("DMY");
  const [separadorDecimal, setSeparadorDecimal] = useState<"," | ".">(",");

  const [filasPreview, setFilasPreview] = useState<FilaPrevia[]>([]);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  const filasCSV = useMemo(() => parseCSV(textoOriginal, delimitador), [textoOriginal, delimitador]);
  const cabeceras = filasCSV[0] ?? [];
  const filasDatos = filasCSV.slice(1);

  async function onArchivoSeleccionado(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const texto = await file.text();
    const primeraLinea = texto.split(/\r?\n/)[0] ?? "";
    const delim = detectarDelimitador(primeraLinea);
    const cab = parseCSV(texto, delim)[0] ?? [];

    setNombreArchivo(file.name);
    setTextoOriginal(texto);
    setDelimitador(delim);
    setColFecha(adivinarColumna(cab, ["fecha", "date"]));
    setColDescripcion(adivinarColumna(cab, ["concepto", "descrip", "detalle", "movimiento"]));
    setColImporte(adivinarColumna(cab, ["importe", "cantidad", "amount"]));
    setColCargo(adivinarColumna(cab, ["cargo", "debe", "debit"]));
    setColAbono(adivinarColumna(cab, ["abono", "haber", "credit"]));
    setResultado(null);
    setPaso("mapear");
  }

  function calcularPreview() {
    const idxFecha = cabeceras.indexOf(colFecha);
    const idxDescripcion = cabeceras.indexOf(colDescripcion);
    const idxImporte = cabeceras.indexOf(colImporte);
    const idxCargo = cabeceras.indexOf(colCargo);
    const idxAbono = cabeceras.indexOf(colAbono);

    const filas: FilaPrevia[] = filasDatos.map((fila) => {
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

      const valida = fecha !== null && descripcion !== "" && importe !== null && importe !== 0;
      const tipo: "ingreso" | "gasto" = (importe ?? 0) >= 0 ? "ingreso" : "gasto";
      const categoriasDisponibles = tipo === "gasto" ? categoriasGasto : categoriasIngreso;
      const sugerida = valida ? sugerirCategoria(descripcion, reglas) : null;
      const categoria_id = sugerida && categoriasDisponibles.some((c) => c.id === sugerida) ? sugerida : null;

      return {
        fecha: fecha ?? "",
        descripcion,
        importe: importe ?? 0,
        tipo,
        categoria_id,
        original: fila.join(" | "),
        valida,
      };
    });

    setFilasPreview(filas);
    setPaso("previsualizar");
  }

  function actualizarCategoria(index: number, categoriaId: string) {
    setFilasPreview((prev) =>
      prev.map((f, i) => (i === index ? { ...f, categoria_id: categoriaId || null } : f))
    );
  }

  async function confirmarImportacion() {
    setImportando(true);
    setResultado(null);

    const filasValidas = filasPreview.filter((f) => f.valida);
    const respuesta = await importarMovimientos(
      cuentaId,
      filasValidas.map(({ fecha, descripcion, importe, tipo, categoria_id }) => ({
        fecha,
        descripcion,
        importe,
        tipo,
        categoria_id,
      }))
    );

    setImportando(false);

    if (respuesta.ok) {
      setResultado(`Se han importado ${respuesta.importados} movimientos correctamente.`);
      setPaso("subir");
      setNombreArchivo("");
      setTextoOriginal("");
      setFilasPreview([]);
      router.refresh();
    } else {
      setResultado(`Error al importar: ${respuesta.error}`);
    }
  }

  const filasValidas = filasPreview.filter((f) => f.valida);
  const filasInvalidas = filasPreview.length - filasValidas.length;
  const totalImporte = filasValidas.reduce((suma, f) => suma + f.importe, 0);

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
          <label className="block text-xs text-slate-500">Archivo CSV</label>
          <input type="file" accept=".csv,text/csv" onChange={onArchivoSeleccionado} className="mt-1 block text-sm" />
          {nombreArchivo && <p className="mt-1 text-xs text-slate-400">Archivo: {nombreArchivo}</p>}
        </div>
      </div>

      {paso !== "subir" && cabeceras.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
          <h2 className="text-sm font-medium text-slate-700">Mapeo de columnas</h2>
          <p className="text-xs text-slate-400">
            Cada banco exporta el CSV con sus propias columnas — indica aquí a qué corresponde cada una.
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
            <div>
              <label className="block text-xs text-slate-500">Columna fecha</label>
              <select
                value={colFecha}
                onChange={(e) => setColFecha(e.target.value)}
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
                onChange={(e) => setColImporte(e.target.value)}
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
                  onChange={(e) => setColCargo(e.target.value)}
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
                  onChange={(e) => setColAbono(e.target.value)}
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

          <button
            type="button"
            onClick={calcularPreview}
            disabled={
              !colFecha || !colDescripcion || (modoImporte === "unico" ? !colImporte : !colCargo && !colAbono)
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
              Previsualización — {filasValidas.length} movimientos listos para importar
            </h2>
            <p className="text-sm font-medium">Total: {formatEUR(totalImporte)}</p>
          </div>

          {filasInvalidas > 0 && (
            <p className="text-xs text-amber-600">
              {filasInvalidas} filas no se han podido leer (fecha o importe con formato inesperado) y se
              omitirán. Revisa el mapeo de columnas si el número es mayor de lo esperado.
            </p>
          )}

          <div className="max-h-[28rem] overflow-y-auto overflow-x-auto rounded-md border border-slate-100">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Fecha</th>
                  <th className="px-3 py-2 font-medium">Descripción</th>
                  <th className="px-3 py-2 font-medium text-right">Importe</th>
                  <th className="px-3 py-2 font-medium">Categoría</th>
                </tr>
              </thead>
              <tbody>
                {filasPreview.map((fila, index) => (
                  <tr key={index} className={`border-t border-slate-100 ${!fila.valida ? "opacity-40" : ""}`}>
                    <td className="px-3 py-2 whitespace-nowrap text-slate-500">
                      {fila.valida ? formatFecha(fila.fecha) : `Sin leer (${fila.original})`}
                    </td>
                    <td className="px-3 py-2">{fila.descripcion || "—"}</td>
                    <td
                      className={`px-3 py-2 text-right font-medium ${
                        fila.importe < 0 ? "text-slate-900" : "text-emerald-600"
                      }`}
                    >
                      {fila.valida ? formatEUR(fila.importe) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {fila.valida && (
                        <select
                          value={fila.categoria_id ?? ""}
                          onChange={(e) => actualizarCategoria(index, e.target.value)}
                          className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                        >
                          <option value="">Sin categoría</option>
                          {(fila.tipo === "gasto" ? categoriasGasto : categoriasIngreso).map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.nombre}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
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
              disabled={importando || filasValidas.length === 0}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40"
            >
              {importando ? "Importando…" : `Confirmar importación (${filasValidas.length})`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
