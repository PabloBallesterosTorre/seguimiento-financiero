import { Nav } from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { crearCuenta, eliminarCuenta } from "./actions";

function formatEUR(value: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

export default async function CuentasPage() {
  const supabase = createClient();
  const { data: cuentas } = await supabase
    .from("cuentas")
    .select("*")
    .order("created_at", { ascending: true });

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-4 py-8 space-y-8">
        <h1 className="text-xl font-semibold">Cuentas</h1>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Banco</th>
                <th className="px-4 py-2 font-medium">Cuenta</th>
                <th className="px-4 py-2 font-medium">Tipo</th>
                <th className="px-4 py-2 font-medium text-right">Saldo</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {(cuentas ?? []).map((cuenta) => (
                <tr key={cuenta.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">{cuenta.banco_nombre}</td>
                  <td className="px-4 py-2">{cuenta.nombre}</td>
                  <td className="px-4 py-2 capitalize">{cuenta.tipo}</td>
                  <td className="px-4 py-2 text-right">{formatEUR(Number(cuenta.saldo_actual))}</td>
                  <td className="px-4 py-2 text-right">
                    <form action={eliminarCuenta}>
                      <input type="hidden" name="id" value={cuenta.id} />
                      <button className="text-slate-400 hover:text-red-600" type="submit">
                        Eliminar
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {(cuentas ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                    Todavía no has dado de alta ninguna cuenta.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-medium text-slate-700">Añadir cuenta</h2>
          <form action={crearCuenta} className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div>
              <label className="block text-xs text-slate-500">Banco</label>
              <input
                name="banco"
                required
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Ibercaja"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500">Nombre de la cuenta</label>
              <input
                name="nombre"
                required
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Cuenta corriente"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500">Tipo</label>
              <select
                name="tipo"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="corriente">Corriente</option>
                <option value="ahorro">Ahorro</option>
                <option value="conjunta">Conjunta</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500">Saldo actual</label>
              <input
                name="saldo_actual"
                type="number"
                step="0.01"
                defaultValue={0}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-4">
              <button
                type="submit"
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                Añadir cuenta
              </button>
            </div>
          </form>
        </div>
      </main>
    </>
  );
}
