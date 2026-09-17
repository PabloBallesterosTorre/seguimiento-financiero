import { formatMoneda } from "@/lib/formato";

// Las cuatro cifras que responden a "¿cómo va mi inversión?". Se separan a propósito el
// porcentaje simple y la TIR: dicen cosas distintas y con aportaciones periódicas el
// primero se queda muy corto (ver el comentario de tirAnualizada en lib/inversiones.ts).
export function ResumenCartera({
  valor,
  aportado,
  ganancia,
  rentabilidadSimple,
  tir,
  moneda,
}: {
  valor: number;
  aportado: number;
  ganancia: number;
  rentabilidadSimple: number | null;
  tir: number | null;
  moneda: string;
}) {
  const formatEUR = (v: number) => formatMoneda(v, moneda);
  const enVerde = ganancia >= 0;
  const colorGanancia = enVerde ? "text-success" : "text-danger";
  const signo = enVerde ? "+" : "";

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <Tarjeta label="Valor de mercado" valor={formatEUR(valor)} />
      <Tarjeta label="Aportado neto" valor={formatEUR(aportado)} nota="Lo metido menos lo retirado" />
      <Tarjeta
        label="Ganancia"
        valor={`${signo}${formatEUR(ganancia)}`}
        clase={colorGanancia}
        nota={rentabilidadSimple !== null ? `${signo}${rentabilidadSimple.toFixed(2)}% sobre lo aportado` : undefined}
      />
      <Tarjeta
        label="TIR anual"
        valor={tir !== null ? `${tir >= 0 ? "+" : ""}${tir.toFixed(2)}%` : "—"}
        clase={tir !== null ? (tir >= 0 ? "text-success" : "text-danger") : undefined}
        nota={tir !== null ? "Rentabilidad anualizada real" : "Hacen falta al menos dos fechas"}
      />
    </div>
  );
}

function Tarjeta({ label, valor, clase, nota }: { label: string; valor: string; clase?: string; nota?: string }) {
  return (
    <div className="rounded-card border border-border bg-surface p-5 shadow-card">
      <p className="text-xs text-ink-secondary">{label}</p>
      <p className={`mt-1.5 font-sora text-lg font-semibold ${clase ?? "text-ink"}`}>{valor}</p>
      {nota && <p className="mt-1 text-[11px] text-ink-tertiary">{nota}</p>}
    </div>
  );
}
