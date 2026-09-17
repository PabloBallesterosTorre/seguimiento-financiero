import Link from "next/link";

export type Ambito = "personal" | "conjunto" | "todo";

const OPCIONES: { valor: Ambito; etiqueta: string; ayuda: string }[] = [
  { valor: "personal", etiqueta: "Personal", ayuda: "Solo tus cuentas" },
  { valor: "conjunto", etiqueta: "Conjunto", ayuda: "Solo las cuentas compartidas" },
  { valor: "todo", etiqueta: "Todo", ayuda: "Las dos cosas juntas" },
];

// El ámbito atraviesa toda la pantalla: cambia las cuatro preguntas a la vez, no un
// gráfico concreto. Por eso va arriba del todo y en forma de pestañas, no escondido en el
// selector de cuentas — que sigue existiendo debajo para afinar dentro de un ámbito.
//
// Cuando se elige Personal o Conjunto se ignora la preferencia de cuentas excluidas de
// informes: si pides ver el conjunto, quieres ver el conjunto entero, no el conjunto menos
// las cuentas que habías escondido del resumen global.
export function SelectorAmbito({ actual, queryBase }: { actual: Ambito; queryBase: string }) {
  return (
    <div>
      <div className="flex w-fit rounded-full bg-chip p-1 text-sm">
        {OPCIONES.map((o) => (
          <Link
            key={o.valor}
            href={`/informes?ambito=${o.valor}${queryBase}`}
            aria-current={actual === o.valor ? "page" : undefined}
            className={`rounded-full px-[18px] py-2.5 text-sm font-semibold transition-colors ${
              actual === o.valor ? "bg-ink text-white" : "text-ink-secondary hover:text-ink"
            }`}
          >
            {o.etiqueta}
          </Link>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-ink-tertiary">
        {OPCIONES.find((o) => o.valor === actual)?.ayuda}
        {actual !== "todo" && " · el dinero que pasa de un lado a otro se ve como gasto en Personal y como ingreso en Conjunto"}
      </p>
    </div>
  );
}
