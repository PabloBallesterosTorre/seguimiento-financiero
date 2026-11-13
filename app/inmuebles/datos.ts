import type { createClient } from "@/lib/supabase/server";
import { mesesHasta, type MovimientoInmueble } from "@/lib/inmuebles";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type MovimientoInmuebleFila = MovimientoInmueble & {
  id: string;
  descripcion: string;
  categoria: string | null;
  cuenta: string | null;
};

type InmuebleClave = { id: string; deuda_id: string | null };
type DeudaClave = { id: string; categoria_id: string | null };

// Los movimientos de cada inmueble: los vinculados a mano (o aprendidos) más las cuotas de
// su hipoteca, que se reconocen por la categoría de pago de la deuda y no hace falta
// vincular. Si una cuota está además vinculada, cuenta una sola vez.
export async function movimientosPorInmueble(
  supabase: SupabaseServerClient,
  inmuebles: InmuebleClave[],
  deudas: DeudaClave[],
  opciones: { desde?: string } = {}
): Promise<Map<string, MovimientoInmuebleFila[]>> {
  const resultado = new Map<string, MovimientoInmuebleFila[]>(inmuebles.map((i) => [i.id, []]));
  if (inmuebles.length === 0) return resultado;

  const categoriaDeuda = new Map(deudas.map((d) => [d.id, d.categoria_id]));
  const categoriasHipoteca = inmuebles
    .map((i) => (i.deuda_id ? categoriaDeuda.get(i.deuda_id) : null))
    .filter((c): c is string => !!c);

  const SELECT = "id, fecha, descripcion, importe, categoria_id, inmueble_id, categorias!categoria_id(nombre), cuentas(nombre, banco_nombre)";
  let vinculados = supabase.from("movimientos").select(SELECT).in("inmueble_id", inmuebles.map((i) => i.id));
  let cuotas = supabase.from("movimientos").select(SELECT).in("categoria_id", categoriasHipoteca.length ? categoriasHipoteca : ["00000000-0000-0000-0000-000000000000"]);
  if (opciones.desde) {
    vinculados = vinculados.gte("fecha", opciones.desde);
    cuotas = cuotas.gte("fecha", opciones.desde);
  }
  const [{ data: a }, { data: b }] = await Promise.all([
    vinculados.order("fecha", { ascending: false }).throwOnError(),
    cuotas.order("fecha", { ascending: false }).throwOnError(),
  ]);

  type Fila = {
    id: string;
    fecha: string;
    descripcion: string;
    importe: number;
    categoria_id: string | null;
    inmueble_id: string | null;
    categorias: { nombre: string } | null;
    cuentas: { nombre: string; banco_nombre: string } | null;
  };
  const todas = new Map<string, Fila>();
  for (const f of [...((a ?? []) as unknown as Fila[]), ...((b ?? []) as unknown as Fila[])]) todas.set(f.id, f);

  for (const inmueble of inmuebles) {
    const categoriaHipoteca = inmueble.deuda_id ? categoriaDeuda.get(inmueble.deuda_id) ?? null : null;
    const suyas = Array.from(todas.values())
      .filter((f) => f.inmueble_id === inmueble.id || (categoriaHipoteca !== null && f.categoria_id === categoriaHipoteca))
      .map((f) => ({
        id: f.id,
        fecha: f.fecha,
        descripcion: f.descripcion,
        importe: Number(f.importe),
        esCuotaHipoteca: categoriaHipoteca !== null && f.categoria_id === categoriaHipoteca,
        categoria: f.categorias?.nombre ?? null,
        cuenta: f.cuentas ? `${f.cuentas.banco_nombre} — ${f.cuentas.nombre}` : null,
      }))
      .sort((x, y) => (x.fecha < y.fecha ? 1 : -1));
    resultado.set(inmueble.id, suyas);
  }
  return resultado;
}

/** Primer día de la ventana de 12 meses que acaba en el mes de `hoy`. */
export function inicioVentana(hoy: string): string {
  return `${mesesHasta(hoy, 12)[0]}-01`;
}
