import { Nav } from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { crearMovimiento, eliminarMovimiento } from "./actions";

function formatEUR(value: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function formatFecha(value: string) {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(new Date(value));
}

export default async function MovimientosPage() {
  const supabase = createClient();

  const [{ data: movimientos }, { data: cuentas }, { data: categorias }] = await Promise.all([
    supabase
      .from("movimientos")
      .select("*, cuentas(nombre, banco_nombre), categorias!categoria_id(nombre)")
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("cuentas").select("id, nombre, banco_nombre").eq("activa", true).order("nombre"),
    supabase
      .from("categorias")
      .select("id, nombre, tipo")
      .is("categoria_padre_id", null)
      .order("nombre"),
  ]);

  const categoriasIngreso = (categorias ?? []).filter((c) => c.tipo === "ingreso");
  const categoriasGasto = (categorias ?? []).filter((c) => c.tipo === "gasto");
  const hayCuentas = (cuentas ?? []).length > 0;
  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-4 py-8 space-y-8">
        <h1 className="text-xl font-semibold">Movimientos</h1>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Fecha</th>
                <th className="px-4 py-2 font-medium">Cuenta</th>
                <th className="px-4 py-2 font-medium">Descripción</th>
                <th className="px-4 py-2 font-medium">Categoría</th>
                <th className="px-4 py-2 font-medium text-right">Importe</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {(movimientos ?? []).map((mov) => (
                <tr key={mov.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 whitespace-nowrap text-slate-500">{formatFecha(mov.fecha)}</td>
                  <td className="px-4 py-2">{mov.cuentas?.nombre ?? "—"}</td>
                  <td className="px-4 py-2">{mov.descripcion}</td>
                  <td className="px-4 py-2 text-slate-500">{mov.categorias?.nombre ?? "Sin categoría"}</td>
                  <td
                    className={`px-4 py-2 text-right font-medium ${
                      Number(mov.importe) < 0 ? "text-slate-900" : "text-emerald-600"
                    }`}
                  >
                    {formatEUR(Number(mov.importe))}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <form action={eliminarMovimiento}>
                      <input type="hidden" name="id" value={mov.id} />
                      <button className="text-slate-400 hover:text-red-600" type="submit">
                        Eliminar
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {(movimientos ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                    Todavía no hay movimientos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-medium text-slate-700">Añadir movimiento</h2>

          {!hayCuentas ? (
            <p className="text-sm text-slate-400">
              Antes de añadir movimientos, da de alta una cuenta en la sección Cuentas.
            </p>
          ) : (
            <form action={crearMovimiento} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs text-slate-500">Fecha</label>
                <input
                  name="fecha"
                  type="date"
                  required
                  defaultValue={hoy}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500">Cuenta</label>
                <select
                  name="cuenta_id"
                  required
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  {(cuentas ?? []).map((cuenta) => (
                    <option key={cuenta.id} value={cuenta.id}>
                      {cuenta.banco_nombre} — {cuenta.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500">Tipo</label>
                <select
                  name="tipo"
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="gasto">Gasto</option>
                  <option value="ingreso">Ingreso</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500">Importe</label>
                <input
                  name="importe"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  placeholder="0.00"
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500">Categoría</label>
                <select
                  name="categoria_id"
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Sin categoría</option>
                  {categoriasGasto.length > 0 && (
                    <optgroup label="Gastos">
                      {categoriasGasto.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.nombre}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {categoriasIngreso.length > 0 && (
                    <optgroup label="Ingresos">
                      {categoriasIngreso.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.nombre}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-slate-500">Descripción</label>
                <input
                  name="descripcion"
                  required
                  placeholder="Mercadona"
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="sm:col-span-3">
                <button
                  type="submit"
                  className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
                >
                  Añadir movimiento
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
    </>
  );
}
