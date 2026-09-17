"use client";

import { useCallback, useMemo, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { parseCSV, detectarDelimitador, detectarFilaCabecera } from "@/lib/csv";
import { parseXLSX } from "@/lib/xlsx";
import {
  parseFechaImportada,
  parseImporteImportado,
  combinarImporteConComisionYRetencion,
  comisionDeLaFila,
  detectarFormatoFecha,
  detectarSeparadorDecimal,
  diaSiguienteISO,
  type FormatoFecha,
} from "@/lib/importarCsv";
import { sugerirCategoria, type ReglaCategorizacion } from "@/lib/categorizacion";
import type { CategoriaJerarquica } from "@/lib/categorias";
import { importeEstimado, previstosCoincidentes, type MovimientoPrevisto } from "@/lib/prevision";
import { mesDe, type OpcionesMesFinanciero } from "@/lib/mesFinanciero";
import { importarMovimientos, importarTraspasos, type FilaImportar } from "./actions";
import { formatMoneda } from "@/lib/formato";

type Cuenta = { id: string; nombre: string; banco_nombre: string; iban: string | null };
type InversionConocida = { id: string; nombre: string; isin: string | null };
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

// Tipo de activo propuesto para una posición que todavía no existe. Se adivina por el
// nombre porque el extracto no trae una clasificación que sirva tal cual (Trade Republic
// distingue FUND de MUTUAL_FUND, que para esta app son lo mismo), y en cualquier caso el
// usuario lo puede corregir en la vista previa antes de confirmar.
function adivinarTipoActivo(nombre: string): string {
  const n = nombre.toLowerCase();
  if (/etf|fund|index|índice|indice|ucits|vanguard|ishares|amundi/.test(n)) return "Fondo indexado";
  if (/bitcoin|ethereum|cripto|crypto|btc|eth/.test(n)) return "Cripto";
  return "Acciones";
}

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

export function ImportarCSV({
  cuentas,
  categorias,
  reglas,
  existentes,
  previstos,
  inversiones,
  moneda,
  opcionesMes,
}: {
  cuentas: Cuenta[];
  categorias: CategoriaJerarquica[];
  reglas: ReglaCategorizacion[];
  existentes: MovimientoExistente[];
  previstos: MovimientoPrevisto[];
  inversiones: InversionConocida[];
  moneda: string;
  // Cómo se traducen las fechas a meses (de nómina a nómina si está activado). Sin esto,
  // la nómina del 28 de agosto se evaluaba contra agosto y no encontraba su previsión.
  opcionesMes: OpcionesMesFinanciero;
}) {
  const router = useRouter();
  const formatEUR = (v: number) => formatMoneda(v, moneda);
  const mesDeFecha = useCallback((fecha: string) => mesDe(fecha, opcionesMes), [opcionesMes]);

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
    return ultima ? diaSiguienteISO(ultima) : "";
  });

  function setCuentaId(id: string) {
    setCuentaIdState(id);
    const ultima = ultimaFechaPorCuenta.get(id);
    setFechaCorte(ultima ? diaSiguienteISO(ultima) : "");
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
  const [colIsin, setColIsin] = useState("");
  const [colParticipaciones, setColParticipaciones] = useState("");
  const [colPrecio, setColPrecio] = useState("");
  const [colNombreActivo, setColNombreActivo] = useState("");
  // Posiciones nuevas que la importación daría de alta, indexadas por ISIN: el usuario
  // puede desmarcarlas o corregirles el nombre y el tipo antes de confirmar.
  const [nuevasInversiones, setNuevasInversiones] = useState<
    { isin: string; nombre: string; tipoActivo: string; incluir: boolean }[]
  >([]);
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
    const colCargoDetectada = adivinarColumna(cab, ["cargo", "debe", "debit", "saliente"]);
    const colAbonoDetectada = adivinarColumna(cab, ["abono", "haber", "credit", "entrante"]);
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
    // Columnas de inversión. Las trae el extracto de un bróker (Trade Republic las llama
    // symbol / shares / price / name); un extracto bancario normal no las tiene y estos
    // selectores se quedan vacíos sin estorbar.
    setColIsin(adivinarColumna(cab, ["isin", "symbol", "simbolo", "símbolo", "ticker"]));
    setColParticipaciones(adivinarColumna(cab, ["shares", "participaciones", "titulos", "títulos", "quantity"]));
    setColPrecio(adivinarColumna(cab, ["price", "precio"]));
    setColNombreActivo(adivinarColumna(cab, ["name", "activo", "instrumento"]));

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
    const idxIsin = cabeceras.indexOf(colIsin);
    const idxParticipaciones = cabeceras.indexOf(colParticipaciones);
    const idxPrecio = cabeceras.indexOf(colPrecio);
    const idxNombreActivo = cabeceras.indexOf(colNombreActivo);

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

      // Datos de inversión. Solo cuentan juntos: sin ISIN no se sabe a qué posición va, y
      // sin participaciones no hay compra ni venta que registrar (un "saveback" de Trade
      // Republic viene asociado a un fondo pero es dinero que entra en la cuenta, todavía
      // no ha comprado nada — se queda como movimiento normal, que es lo que es).
      const isinCrudo = idxIsin >= 0 ? (fila[idxIsin] ?? "").replace(/\s+/g, "").toUpperCase() : "";
      const participaciones =
        idxParticipaciones >= 0 ? parseImporteImportado(fila[idxParticipaciones] ?? "", separadorDecimal) : null;
      const precio = idxPrecio >= 0 ? parseImporteImportado(fila[idxPrecio] ?? "", separadorDecimal) : null;
      const nombreActivo = idxNombreActivo >= 0 ? (fila[idxNombreActivo] ?? "").trim() : "";
      const esOperacionInversion = valida && isinCrudo !== "" && participaciones !== null && participaciones !== 0;

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
        isin: esOperacionInversion ? isinCrudo : null,
        participaciones: esOperacionInversion ? participaciones : null,
        precio: esOperacionInversion ? precio : null,
        comision: esOperacionInversion
          ? comisionDeLaFila(idxComision >= 0 ? fila[idxComision] : undefined, separadorDecimal)
          : null,
        nombreActivo: esOperacionInversion ? nombreActivo || isinCrudo : null,
      };
    });

    // Posiciones que habría que dar de alta: los ISIN que aparecen en el archivo y que no
    // tiene todavía ninguna inversión. Se proponen marcadas, con el nombre y el tipo ya
    // rellenados, para que dar de alta una posición nueva no obligue a salir de aquí.
    const isinesConocidos = new Set(inversiones.map((i) => i.isin).filter((v): v is string => Boolean(v)));
    const nuevas = new Map<string, { isin: string; nombre: string; tipoActivo: string; incluir: boolean }>();
    for (const f of filas) {
      if (!f.isin || f.omitidaPorFechaCorte || f.esDuplicado || isinesConocidos.has(f.isin) || nuevas.has(f.isin)) continue;
      const nombre = f.nombreActivo ?? f.isin;
      nuevas.set(f.isin, { isin: f.isin, nombre, tipoActivo: adivinarTipoActivo(nombre), incluir: true });
    }

    setNuevasInversiones([...nuevas.values()]);
    setFilasPreview(
      filas.map((f) =>
        f.valida && !f.esTraspaso ? { ...f, previstoId: previstoAutomatico(f) } : f
      )
    );
    setPaso("previsualizar");
  }

  // Conciliación automática: si un movimiento encaja con UNA sola previsión, se vincula
  // solo. Con varios candidatos no se elige ninguno — una conciliación equivocada descuadra
  // la proyección de ese mes, y ahí sí compensa preguntar.
  //
  // Sin esto había que vincular a mano previsión por previsión, y en la práctica no se hacía:
  // los previstos fijos ya pagados se seguían sumando a un saldo que ya los tenía
  // descontados. En septiembre de 2026 eran unos 1.600 € contados dos veces.
  function previstoAutomatico(fila: { fecha: string; tipo: "ingreso" | "gasto"; categoria_id: string | null; importe: number }) {
    const candidatos = previstosCoincidentes(fila, previstos, mesDeFecha);
    return candidatos.length === 1 ? candidatos[0].id : null;
  }

  function actualizarCategoria(index: number, categoriaId: string) {
    setFilasPreview((prev) =>
      prev.map((f, i) =>
        i === index
          ? {
              ...f,
              categoria_id: categoriaId || null,
              // La categoría es lo que decide qué previsiones encajan, así que al cambiarla
              // se recalcula el vínculo en vez de limpiarlo sin más.
              previstoId: previstoAutomatico({ ...f, categoria_id: categoriaId || null }),
            }
          : f
      )
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
            filasNormales.map((f) => {
              // Una posición desmarcada en la vista previa no se crea: la fila entra como
              // movimiento normal y su operación se puede registrar más tarde a mano.
              const nueva = f.isin ? nuevasInversiones.find((n) => n.isin === f.isin) : undefined;
              const descartada = nueva !== undefined && !nueva.incluir;

              return {
                fecha: f.fecha,
                descripcion: f.descripcion,
                importe: f.importe,
                tipo: f.tipo,
                categoria_id: f.categoria_id,
                previstoId: f.previstoId,
                isin: descartada ? null : f.isin,
                participaciones: descartada ? null : f.participaciones,
                precio: descartada ? null : f.precio,
                comision: descartada ? null : f.comision,
                nombreActivo: nueva?.nombre ?? f.nombreActivo,
                tipoActivo: nueva?.tipoActivo ?? null,
              };
            })
          )
        : Promise.resolve({ ok: true as const, importados: 0, conciliados: 0 }),
      filasTraspaso.length > 0
        ? importarTraspasos(
            cuentaId,
            filasTraspaso.map((f) => ({
              fecha: f.fecha,
              descripcion: f.descripcion,
              importe: f.importe,
              categoria_id: f.categoria_id,
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
      const operaciones = "operaciones" in respuestaMovimientos ? respuestaMovimientos.operaciones : 0;
      const inversionesNuevas =
        "inversionesNuevas" in respuestaMovimientos ? respuestaMovimientos.inversionesNuevas : 0;

      const detalles: string[] = [];
      if (conciliados > 0) detalles.push(`${conciliados} conciliados con su previsión`);
      if (operaciones > 0) detalles.push(`${operaciones} operaciones de inversión registradas`);
      if (inversionesNuevas > 0) detalles.push(`${inversionesNuevas} posiciones nuevas`);
      const sufijo = detalles.length > 0 ? ` (${detalles.join(", ")})` : "";

      setResultado(`Se han importado ${partes.join(" y ")} correctamente${sufijo}.`);
      setPaso("subir");
      setNombreArchivo("");
      setTextoOriginal("");
      setFilasCrudas([]);
      setFilasPreview([]);
      setNuevasInversiones([]);
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
  const operacionesDetectadas = filasAImportar.filter((f) => Boolean(f.isin)).length;
  const previewFilasCrudas = filasCSV.slice(0, 8);

  return (
    <div className="space-y-6">
      {resultado && (
        <div
          className={`rounded-btn border px-4 py-3 text-sm ${
            resultado.startsWith("Error")
              ? "border-danger/25 bg-danger/8 text-danger"
              : "border-success/25 bg-success/8 text-success"
          }`}
        >
          {resultado}
        </div>
      )}

      <div className="rounded-card border border-border bg-surface p-7 shadow-card space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-ink-secondary">Cuenta destino</label>
          <select
            value={cuentaId}
            onChange={(e) => setCuentaId(e.target.value)}
            className="mt-1 w-full max-w-sm rounded-btn border border-border-strong bg-field px-3 py-2.5 text-sm text-ink"
          >
            {cuentas.map((cuenta) => (
              <option key={cuenta.id} value={cuenta.id}>
                {cuenta.banco_nombre} — {cuenta.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-ink-secondary">Archivo CSV o Excel</label>
          <input
            type="file"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={onArchivoSeleccionado}
            className="mt-1 block w-full max-w-md cursor-pointer rounded-btn border border-dashed border-border-strong bg-field px-3 py-3 text-sm text-ink-secondary file:mr-3 file:cursor-pointer file:rounded-btn file:border-0 file:bg-ink file:px-3.5 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:file:bg-ink/90"
          />
          <p className="mt-1.5 text-xs text-ink-tertiary">
            Formatos admitidos: CSV y Excel (.xlsx). El archivo se procesa en tu navegador.
          </p>
          {nombreArchivo && <p className="mt-1.5 text-xs text-ink-tertiary">Archivo: {nombreArchivo}</p>}
        </div>
      </div>

      {paso !== "subir" && filasCSV.length > 0 && (
        <div className="rounded-card border border-border bg-surface p-7 shadow-card space-y-4">
          <h2 className="text-sm font-medium text-ink-secondary">Mapeo de columnas</h2>
          <p className="text-xs text-ink-tertiary">
            Cada banco exporta el archivo con sus propias columnas (y a veces con filas de texto antes
            de la tabla) — indica aquí a qué corresponde cada cosa.
          </p>

          <div className="max-h-40 overflow-y-auto overflow-x-auto rounded-card border border-border text-xs">
            <table className="w-full">
              <tbody>
                {previewFilasCrudas.map((fila, i) => (
                  <tr
                    key={i}
                    className={`border-t border-border first:border-t-0 ${
                      i === filaCabecera - 1 ? "bg-forecast/10 font-medium" : ""
                    }`}
                  >
                    <td className="px-2 py-1 text-ink-tertiary">{i + 1}</td>
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
              <label className="mb-1.5 block text-xs font-semibold text-ink-secondary">Fila de cabecera</label>
              <input
                type="number"
                min={1}
                max={filasCSV.length}
                value={filaCabecera}
                onChange={(e) => onCambiarFilaCabecera(Math.max(1, Number(e.target.value) || 1))}
                className="mt-1 w-full rounded-btn border border-border-strong bg-field px-3 py-2.5 text-sm text-ink"
              />
              <p className="mt-1.5 text-xs text-ink-tertiary">Resaltada arriba. Súbela si el archivo trae texto antes.</p>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-ink-secondary">Fecha de corte (opcional)</label>
              <input
                type="date"
                value={fechaCorte}
                onChange={(e) => setFechaCorte(e.target.value)}
                className="mt-1 w-full rounded-btn border border-border-strong bg-field px-3 py-2.5 text-sm text-ink"
              />
              <p className="mt-1.5 text-xs text-ink-tertiary">
                Se ignora todo lo anterior a esta fecha, aunque el archivo lo incluya (evita reimportar
                movimientos antiguos o que borraste a propósito). Por defecto, el día siguiente al último
                movimiento que ya tienes en esta cuenta.
              </p>
            </div>
            {modoArchivo === "csv" && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-ink-secondary">Delimitador</label>
                <select
                  value={delimitador}
                  onChange={(e) => setDelimitador(e.target.value)}
                  className="mt-1 w-full rounded-btn border border-border-strong bg-field px-3 py-2.5 text-sm text-ink"
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
              <label className="mb-1.5 block text-xs font-semibold text-ink-secondary">Columna fecha</label>
              <select
                value={colFecha}
                onChange={(e) => onCambiarColFecha(e.target.value)}
                className="mt-1 w-full rounded-btn border border-border-strong bg-field px-3 py-2.5 text-sm text-ink"
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
              <label className="mb-1.5 block text-xs font-semibold text-ink-secondary">Formato de fecha</label>
              <select
                value={formatoFecha}
                onChange={(e) => setFormatoFecha(e.target.value as FormatoFecha)}
                className="mt-1 w-full rounded-btn border border-border-strong bg-field px-3 py-2.5 text-sm text-ink"
              >
                {FORMATOS_FECHA.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-ink-secondary">Columna descripción</label>
              <select
                value={colDescripcion}
                onChange={(e) => setColDescripcion(e.target.value)}
                className="mt-1 w-full rounded-btn border border-border-strong bg-field px-3 py-2.5 text-sm text-ink"
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
              <label className="mb-1.5 block text-xs font-semibold text-ink-secondary">Separador decimal</label>
              <select
                value={separadorDecimal}
                onChange={(e) => setSeparadorDecimal(e.target.value as "," | ".")}
                className="mt-1 w-full rounded-btn border border-border-strong bg-field px-3 py-2.5 text-sm text-ink"
              >
                <option value=",">Coma (1.234,56)</option>
                <option value=".">Punto (1234.56)</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-ink-secondary">
                Columna IBAN contraparte (opcional)
              </label>
              <select
                value={colIbanContraparte}
                onChange={(e) => setColIbanContraparte(e.target.value)}
                className="mt-1 w-full rounded-btn border border-border-strong bg-field px-3 py-2.5 text-sm text-ink"
              >
                <option value="">Sin usar</option>
                {cabeceras.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-ink-tertiary">
                Si coincide con el IBAN de otra de tus cuentas, se marcará como traspaso.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 rounded-card border border-border bg-page p-5">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-ink-secondary">Filtrar por columna (opcional)</label>
              <select
                value={colFiltro}
                onChange={(e) => onCambiarColFiltro(e.target.value)}
                className="mt-1 w-full rounded-btn border border-border-strong bg-field px-3 py-2.5 text-sm text-ink"
              >
                <option value="">Sin filtrar (usar todas las filas)</option>
                {cabeceras.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-ink-tertiary">
                Útil si el archivo mezcla varias cuentas en uno (p. ej. Revolut exporta Actual, Ahorros y
                Depósito juntos, distinguidas por una columna "Producto"): elige aquí esa columna.
              </p>
            </div>
            {colFiltro && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-ink-secondary">Valor a importar</label>
                <select
                  value={valorFiltro}
                  onChange={(e) => setValorFiltro(e.target.value)}
                  className="mt-1 w-full rounded-btn border border-border-strong bg-field px-3 py-2.5 text-sm text-ink"
                >
                  <option value="">— Selecciona un valor —</option>
                  {valoresColumnaFiltro.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-ink-tertiary">
                  Solo se leerán las filas donde &quot;{colFiltro}&quot; sea exactamente este valor
                  {valorFiltro ? ` (${filasDatosFiltradas.length} de ${filasDatos.length} filas)` : ""}. Repite
                  la importación con otro valor para cada una de tus otras cuentas de este mismo archivo.
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink-secondary">Cómo viene el importe</label>
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
              <label className="mb-1.5 block text-xs font-semibold text-ink-secondary">Columna importe</label>
              <select
                value={colImporte}
                onChange={(e) => onCambiarColImporte(e.target.value)}
                className="mt-1 w-full rounded-btn border border-border-strong bg-field px-3 py-2.5 text-sm text-ink"
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
                <label className="mb-1.5 block text-xs font-semibold text-ink-secondary">Columna cargo (gastos)</label>
                <select
                  value={colCargo}
                  onChange={(e) => onCambiarColCargo(e.target.value)}
                  className="mt-1 w-full rounded-btn border border-border-strong bg-field px-3 py-2.5 text-sm text-ink"
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
                <label className="mb-1.5 block text-xs font-semibold text-ink-secondary">Columna abono (ingresos)</label>
                <select
                  value={colAbono}
                  onChange={(e) => onCambiarColAbono(e.target.value)}
                  className="mt-1 w-full rounded-btn border border-border-strong bg-field px-3 py-2.5 text-sm text-ink"
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
              <label className="mb-1.5 block text-xs font-semibold text-ink-secondary">Columna comisión (opcional)</label>
              <select
                value={colComision}
                onChange={(e) => setColComision(e.target.value)}
                className="mt-1 w-full rounded-btn border border-border-strong bg-field px-3 py-2.5 text-sm text-ink"
              >
                <option value="">Sin usar</option>
                {cabeceras.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-ink-tertiary">
                Si el archivo trae la comisión en una columna aparte (ej. "fee"), se suma al importe.
              </p>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-ink-secondary">Columna retención fiscal (opcional)</label>
              <select
                value={colRetencion}
                onChange={(e) => setColRetencion(e.target.value)}
                className="mt-1 w-full rounded-btn border border-border-strong bg-field px-3 py-2.5 text-sm text-ink"
              >
                <option value="">Sin usar</option>
                {cabeceras.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-ink-tertiary">
                Si el archivo trae la retención fiscal en una columna aparte (ej. "tax"), se suma al importe.
              </p>
            </div>
          </div>

          <div className="space-y-4 rounded-card border border-border bg-surface p-5">
            <div>
              <p className="text-sm font-semibold text-ink-secondary">Inversión (opcional)</p>
              <p className="mt-1.5 text-xs text-ink-tertiary">
                Si el extracto es el de un bróker y trae estas columnas, cada compra y cada venta se registran
                también en el libro de la posición correspondiente, con sus participaciones y su precio. Un
                extracto bancario normal no las tiene: déjalas sin usar.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-ink-secondary">Columna ISIN o símbolo</label>
                <select
                  value={colIsin}
                  onChange={(e) => setColIsin(e.target.value)}
                  className="mt-1 w-full rounded-btn border border-border-strong bg-field px-3 py-2.5 text-sm text-ink"
                >
                  <option value="">Sin usar</option>
                  {cabeceras.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-ink-secondary">Columna participaciones</label>
                <select
                  value={colParticipaciones}
                  onChange={(e) => setColParticipaciones(e.target.value)}
                  className="mt-1 w-full rounded-btn border border-border-strong bg-field px-3 py-2.5 text-sm text-ink"
                >
                  <option value="">Sin usar</option>
                  {cabeceras.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-ink-tertiary">En negativo si es una venta, como lo exporta el bróker.</p>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-ink-secondary">Columna precio por participación</label>
                <select
                  value={colPrecio}
                  onChange={(e) => setColPrecio(e.target.value)}
                  className="mt-1 w-full rounded-btn border border-border-strong bg-field px-3 py-2.5 text-sm text-ink"
                >
                  <option value="">Sin usar</option>
                  {cabeceras.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-ink-tertiary">
                  Con él, cada operación revaloriza la posición entera a esa fecha.
                </p>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-ink-secondary">Columna nombre del activo</label>
                <select
                  value={colNombreActivo}
                  onChange={(e) => setColNombreActivo(e.target.value)}
                  className="mt-1 w-full rounded-btn border border-border-strong bg-field px-3 py-2.5 text-sm text-ink"
                >
                  <option value="">Sin usar</option>
                  {cabeceras.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-ink-tertiary">Solo se usa para nombrar posiciones nuevas.</p>
              </div>
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
            className="rounded-btn bg-ink px-[18px] py-2.5 text-sm font-semibold text-white hover:bg-ink/90 disabled:opacity-40"
          >
            Previsualizar
          </button>
        </div>
      )}

      {paso === "previsualizar" && (
        <div className="rounded-card border border-border bg-surface p-7 shadow-card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-ink-secondary">
              Previsualización — {filasAImportar.length} movimientos listos para importar
            </h2>
            <p className="text-sm font-medium">Total: {formatEUR(totalImporte)}</p>
          </div>

          {filasInvalidas > 0 && (
            <details className="rounded-btn border border-forecast/30 bg-forecast/10 px-3 py-2 text-xs text-forecast">
              <summary className="cursor-pointer font-medium">
                {filasInvalidas} filas no se han podido leer y se omitirán. Ver detalle.
              </summary>
              <p className="mt-2 text-forecast">
                Revisa el mapeo de columnas si el número es mayor de lo esperado.
              </p>
              <table className="mt-2 w-full text-left">
                <thead>
                  <tr className="text-forecast/80">
                    <th className="pr-3 py-1 font-medium">Fila</th>
                    <th className="pr-3 py-1 font-medium">Motivo</th>
                    <th className="py-1 font-medium">Contenido original</th>
                  </tr>
                </thead>
                <tbody>
                  {filasInvalidasDetalle.map((fila, i) => (
                    <tr key={i} className="border-t border-forecast/20 align-top">
                      <td className="pr-3 py-1 whitespace-nowrap text-forecast/80">
                        {filasPreview.indexOf(fila) + 1}
                      </td>
                      <td className="pr-3 py-1 whitespace-nowrap">{fila.motivoInvalido}</td>
                      <td className="py-1 font-mono text-forecast">{fila.original}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}

          {filasOmitidasPorFecha.length > 0 && (
            <p className="text-xs text-ink-tertiary">
              {filasOmitidasPorFecha.length} filas son anteriores a la fecha de corte ({formatFecha(fechaCorte)})
              y se omiten.
            </p>
          )}

          {operacionesDetectadas > 0 && (
            <p className="text-xs text-ink-secondary">
              {operacionesDetectadas} filas traen ISIN y participaciones: además del movimiento se registrará su
              operación en el libro de la posición correspondiente.
            </p>
          )}

          {nuevasInversiones.length > 0 && (
            <div className="space-y-3 rounded-btn border border-accent/25 bg-accent-soft px-4 py-3 text-sm">
              <p className="font-medium text-accent">
                Se darán de alta {nuevasInversiones.length}{" "}
                {nuevasInversiones.length === 1 ? "inversión nueva" : "inversiones nuevas"}
              </p>
              <p className="text-xs text-accent">
                Son ISIN que aparecen en el archivo y que todavía no tienes como posición. Corrige el nombre o el
                tipo si hace falta, o desmárcala para que sus filas entren solo como movimientos.
              </p>
              {nuevasInversiones.map((nueva, i) => (
                <div key={nueva.isin} className="flex flex-wrap items-center gap-2">
                  <input
                    type="checkbox"
                    checked={nueva.incluir}
                    onChange={(e) =>
                      setNuevasInversiones((prev) =>
                        prev.map((n, j) => (i === j ? { ...n, incluir: e.target.checked } : n))
                      )
                    }
                    className="h-4 w-4"
                  />
                  <span className="font-mono text-xs uppercase text-accent">{nueva.isin}</span>
                  <input
                    value={nueva.nombre}
                    onChange={(e) =>
                      setNuevasInversiones((prev) => prev.map((n, j) => (i === j ? { ...n, nombre: e.target.value } : n)))
                    }
                    disabled={!nueva.incluir}
                    className="min-w-0 flex-1 rounded-btn border border-accent/25 px-2 py-1 text-sm disabled:opacity-40"
                  />
                  <select
                    value={nueva.tipoActivo}
                    onChange={(e) =>
                      setNuevasInversiones((prev) =>
                        prev.map((n, j) => (i === j ? { ...n, tipoActivo: e.target.value } : n))
                      )
                    }
                    disabled={!nueva.incluir}
                    className="rounded-btn border border-accent/25 px-2 py-1 text-sm disabled:opacity-40"
                  >
                    {["Fondo indexado", "Acciones", "Cripto", "Cuenta", "Otro"].map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}

          {filasDuplicadasSinConfirmar.length > 0 && (
            <p className="text-xs text-forecast">
              {filasDuplicadasSinConfirmar.length} filas parecen ya existir en esta cuenta (misma fecha,
              importe y descripción) y se omitirán para no duplicarlas. Márcalas como "Importar de todas
              formas" si en realidad son movimientos distintos.
            </p>
          )}

          <div className="max-h-[28rem] overflow-y-auto overflow-x-auto rounded-card border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-page text-left text-ink-tertiary">
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
                    className={`border-t border-border ${
                      !fila.valida || omitidaPorDuplicado || fila.omitidaPorFechaCorte ? "opacity-40" : ""
                    }`}
                  >
                    <td className="px-3 py-2 whitespace-nowrap text-ink-secondary">
                      {fila.valida ? formatFecha(fila.fecha) : `Sin leer (${fila.original})`}
                    </td>
                    <td className="px-3 py-2">
                      {fila.descripcion || "—"}
                      {fila.esDuplicado && (
                        <span className="ml-2 rounded-full bg-forecast/15 px-2 py-0.5 text-xs font-medium text-forecast">
                          Posible duplicado
                        </span>
                      )}
                      {fila.omitidaPorFechaCorte && (
                        <span className="ml-2 rounded-full bg-chip px-2 py-0.5 text-xs font-medium text-ink-secondary">
                          Anterior a la fecha de corte
                        </span>
                      )}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-medium ${
                        fila.importe < 0 ? "text-ink" : "text-success"
                      }`}
                    >
                      {fila.valida ? formatEUR(fila.importe) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {fila.valida && (
                        <div className="space-y-1">
                          {fila.esDuplicado && (
                            <label className="flex items-center gap-1.5 text-xs text-forecast">
                              <input
                                type="checkbox"
                                checked={fila.incluirDuplicado}
                                onChange={(e) => toggleIncluirDuplicado(index, e.target.checked)}
                              />
                              Importar de todas formas
                            </label>
                          )}
                          <label className="flex items-center gap-1.5 text-xs text-accent">
                            <input
                              type="checkbox"
                              checked={fila.esTraspaso}
                              onChange={(e) => toggleTraspaso(index, e.target.checked)}
                              disabled={cuentasContraparte.length === 0}
                            />
                            Es traspaso entre mis cuentas
                          </label>
                          {fila.esTraspaso && (
                            <select
                              value={fila.cuentaContraparteId ?? ""}
                              onChange={(e) => actualizarContraparte(index, e.target.value)}
                              className="w-full rounded-btn border border-border-strong px-2 py-1 text-sm"
                            >
                              {cuentasContraparte.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.banco_nombre} — {c.nombre}
                                </option>
                              ))}
                            </select>
                          )}
                          {/* La categoría se pide también en los traspasos: al mirar los
                              informes de una sola de las dos cuentas, esa pata cuenta como
                              gasto o ingreso real y aparece en su categoría. */}
                          <select
                            value={fila.categoria_id ?? ""}
                            onChange={(e) => actualizarCategoria(index, e.target.value)}
                            className="w-full rounded-btn border border-border-strong px-2 py-1 text-sm"
                          >
                            <option value="">Sin categoría</option>
                            {categorias.map((cat) => (
                              <option key={cat.id} value={cat.id}>
                                {cat.label}
                              </option>
                            ))}
                          </select>
                          {!fila.esTraspaso && (
                            <>
                              {(() => {
                                const candidatos = previstosCoincidentes(
                                  {
                                    fecha: fila.fecha,
                                    tipo: fila.tipo,
                                    categoria_id: fila.categoria_id,
                                    importe: fila.importe,
                                  },
                                  previstos,
                                  mesDeFecha
                                );
                                if (candidatos.length === 0) return null;
                                return (
                                  <select
                                    value={fila.previstoId ?? ""}
                                    onChange={(e) => actualizarPrevisto(index, e.target.value)}
                                    className="w-full rounded-btn border border-accent/40 bg-accent-soft px-2 py-1 text-xs text-accent"
                                    title={
                                      fila.previstoId && candidatos.length === 1
                                        ? "Vinculada automáticamente por ser la única previsión que encaja. Puedes deshacerlo aquí."
                                        : undefined
                                    }
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
              className="rounded-btn border border-border-strong bg-surface px-[18px] py-2.5 text-sm font-semibold text-ink-secondary hover:bg-chip"
            >
              Volver a mapear
            </button>
            <button
              type="button"
              onClick={confirmarImportacion}
              disabled={importando || filasAImportar.length === 0}
              className="rounded-btn bg-ink px-[18px] py-2.5 text-sm font-semibold text-white hover:bg-ink/90 disabled:opacity-40"
            >
              {importando ? "Importando…" : `Confirmar importación (${filasAImportar.length})`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
