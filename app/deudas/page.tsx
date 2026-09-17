import { Nav } from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { crearDeuda, eliminarDeuda } from "./actions";
import { NuevaDeuda } from "./NuevaDeuda";
import { DeudasClient } from "./DeudasClient";
import { obtenerConfiguracion } from "@/lib/configuracion";
import { obtenerOrdenTabla } from "@/lib/ordenTabla";
import { revisarDeuda, type AvisoDeuda } from "@/lib/revisionDeudas";
import { AvisosDeudas } from "./AvisosDeudas";

export default async function DeudasPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: deudas }, config, ordenInicial] = await Promise.all([
    supabase.from("deudas").select("*").order("created_at", { ascending: true }),
    user ? obtenerConfiguracion(supabase, user.id) : null,
    user ? obtenerOrdenTabla(supabase, user.id, "deudas") : null,
  ]);

  // Los gastos de las categorías de deuda: es el contraste que hace falta para detectar una
  // deuda que en realidad no se paga desde aquí.
  //
  // La consulta se acota a esas categorías y no se traen todos los gastos: Supabase corta a
  // 1.000 filas por defecto, y con un histórico largo los recibos de la hipoteca podrían
  // quedarse fuera del corte. El aviso diría entonces que una deuda perfectamente sana no se
  // paga nunca, que es peor que no avisar.
  const categoriasDeDeuda = (deudas ?? []).map((d) => d.categoria_id).filter((id): id is string => Boolean(id));
  const { data: pagosRaw } = categoriasDeDeuda.length
    ? await supabase.from("movimientos").select("categoria_id, importe").lt("importe", 0).in("categoria_id", categoriasDeDeuda)
    : { data: [] };

  const hoy = new Date().toISOString().slice(0, 10);
  const pagosPorCategoria = new Map<string, number[]>();
  for (const m of pagosRaw ?? []) {
    if (!m.categoria_id) continue;
    if (!pagosPorCategoria.has(m.categoria_id)) pagosPorCategoria.set(m.categoria_id, []);
    pagosPorCategoria.get(m.categoria_id)!.push(Math.abs(Number(m.importe)));
  }

  const avisos: AvisoDeuda[] = (deudas ?? []).flatMap((d) =>
    revisarDeuda(
      {
        id: d.id,
        nombre: d.nombre,
        capital_inicial: Number(d.capital_inicial),
        capital_pendiente: Number(d.capital_pendiente),
        cuota: Number(d.cuota),
        fecha_inicio: d.fecha_inicio,
        categoria_id: d.categoria_id ?? null,
      },
      d.categoria_id ? pagosPorCategoria.get(d.categoria_id) ?? [] : [],
      hoy
    )
  );
  const nombrePorDeuda = new Map((deudas ?? []).map((d) => [d.id as string, d.nombre as string]));

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-7xl space-y-6 px-5 py-8 sm:px-10">
        <h1 className="font-sora text-[26px] font-bold text-ink">Deuda</h1>

        <AvisosDeudas avisos={avisos} nombrePorDeuda={nombrePorDeuda} />

        <NuevaDeuda action={crearDeuda} />

        <DeudasClient
          deudas={deudas ?? []}
          moneda={config?.moneda_base ?? "EUR"}
          eliminarDeuda={eliminarDeuda}
          ordenInicial={ordenInicial}
        />
      </main>
    </>
  );
}
