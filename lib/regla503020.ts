// La regla 50/30/20 aplicada al mes en curso: de lo que entra, cuánto se va en lo
// necesario, cuánto en caprichos y cuánto queda como ahorro, comparado con el reparto de
// referencia (50 % / 30 % / 20 %).
//
// Sustituye al gráfico de "Flujo mensual disponible", que decía si un mes cumplía el
// objetivo de ahorro pero no POR QUÉ: un mes con −400 € podía deberse a un recibo anual o
// a cenar fuera cada semana, y el gráfico pintaba los dos igual.

import {
  importeEfectivoPrevisto,
  ocurrenciasPendientesEnMes,
  type MovimientoPrevisto,
} from "./prevision";

export type Bloque = "ingreso" | "necesario" | "capricho";

// El ahorro nunca se marca en una categoría: es lo que sobra. Las categorías de
// inversión van a parar a él porque lo que se aporta a un fondo sigue siendo tuyo.
export type BloqueEfectivo = Bloque | "ahorro" | null;

export const REFERENCIA_503020 = { necesario: 0.5, capricho: 0.3, ahorro: 0.2 } as const;

export type CategoriaConBloque = {
  id: string;
  categoria_padre_id: string | null;
  es_categoria_inversion: boolean;
  bloque: Bloque | null;
};

// Bloque con el que cuenta cada categoría. Una subcategoría sin bloque propio hereda el de
// su padre: así basta con marcar "Ocio" para que Restaurantes y Discoteca caigan en
// Caprichos, y solo hay que tocar la hija que sea la excepción.
export function resolverBloques(categorias: CategoriaConBloque[]): (categoriaId: string | null) => BloqueEfectivo {
  const porId = new Map(categorias.map((c) => [c.id, c]));
  return (categoriaId) => {
    if (!categoriaId) return null;
    const propia = porId.get(categoriaId);
    if (!propia) return null;
    const padre = propia.categoria_padre_id ? porId.get(propia.categoria_padre_id) : undefined;
    if (propia.es_categoria_inversion || padre?.es_categoria_inversion) return "ahorro";
    return propia.bloque ?? padre?.bloque ?? null;
  };
}

export type ApunteReparto = { categoria_id: string | null; importe: number };

export type Reparto = {
  ingresos: number;
  necesario: number;
  capricho: number;
  // Lo que se aporta a inversión. Ya está dentro de `ahorro`; va aparte para poder
  // enseñar cuánto del ahorro está en fondos y cuánto en la cuenta.
  inversion: number;
  // Movimientos en categorías sin bloque o sin categoría. No se esconden: si
  // desaparecieran, el reparto no cuadraría con lo que se ve en las cuentas.
  sinClasificar: number;
  // ingresos − necesario − capricho − sinClasificar. Incluye lo invertido.
  ahorro: number;
};

// Suma los movimientos (reales o previstos, con signo: positivo entra, negativo sale) en
// cada bloque. Todo se NETEA dentro de su bloque: el Bizum de un amigo que paga su parte
// de la cena entra en Restaurantes y resta de Caprichos, no suma a los ingresos.
export function repartir(
  apuntes: ApunteReparto[],
  bloqueDe: (categoriaId: string | null) => BloqueEfectivo,
  ingresosExtra = 0
): Reparto {
  let ingresos = ingresosExtra;
  let necesario = 0;
  let capricho = 0;
  let inversion = 0;
  let sinClasificar = 0;

  for (const a of apuntes) {
    const importe = Number(a.importe);
    switch (bloqueDe(a.categoria_id)) {
      case "ingreso":
        ingresos += importe;
        break;
      case "necesario":
        necesario -= importe;
        break;
      case "capricho":
        capricho -= importe;
        break;
      case "ahorro":
        inversion -= importe;
        break;
      default:
        sinClasificar -= importe;
    }
  }

  return {
    ingresos,
    necesario,
    capricho,
    inversion,
    sinClasificar,
    ahorro: ingresos - necesario - capricho - sinClasificar,
  };
}

export function sumarRepartos(a: Reparto, b: Reparto): Reparto {
  return {
    ingresos: a.ingresos + b.ingresos,
    necesario: a.necesario + b.necesario,
    capricho: a.capricho + b.capricho,
    inversion: a.inversion + b.inversion,
    sinClasificar: a.sinClasificar + b.sinClasificar,
    ahorro: a.ahorro + b.ahorro,
  };
}

// Lo que falta por ocurrir del mes en curso según la previsión, como apuntes con signo.
// Usa la misma regla que el planificador (ocurrenciasPendientesEnMes): un previsto ya
// conciliado no vuelve a contar, y un presupuesto deja de contar en cuanto su categoría
// tiene gasto real ese mes. Los traspasos se saltan, igual que allí.
export function apuntesPendientesDelMes(
  previstos: MovimientoPrevisto[],
  year: number,
  month: number,
  opciones: {
    conciliacionesPorMes?: Map<string, number>;
    categoriasConMovimiento?: ReadonlySet<string>;
    mediaPorCategoria?: Map<string, number>;
  } = {}
): ApunteReparto[] {
  const { mediaPorCategoria = new Map(), ...pendientes } = opciones;
  const apuntes: ApunteReparto[] = [];
  for (const p of previstos) {
    if (p.tipo === "traspaso") continue;
    const ocurrencias = ocurrenciasPendientesEnMes(p, year, month, pendientes);
    if (ocurrencias === 0) continue;
    const importe = importeEfectivoPrevisto(p, mediaPorCategoria) * ocurrencias;
    apuntes.push({ categoria_id: p.categoria_id, importe: p.tipo === "ingreso" ? importe : -importe });
  }
  return apuntes;
}

export type Porcentajes = { necesario: number; capricho: number; ahorro: number; sinClasificar: number };

// Cada bloque como fracción de los ingresos. Sin ingresos no hay reparto que calcular:
// a principio de mes, antes de cobrar, cualquier gasto sería "infinitos por ciento".
export function porcentajes(r: Reparto): Porcentajes | null {
  if (r.ingresos <= 0) return null;
  return {
    necesario: r.necesario / r.ingresos,
    capricho: r.capricho / r.ingresos,
    ahorro: r.ahorro / r.ingresos,
    sinClasificar: r.sinClasificar / r.ingresos,
  };
}
