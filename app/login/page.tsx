import { login, signup } from "./actions";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; message?: string };
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Seguimiento Financiero</h1>
          <p className="mt-1 text-sm text-slate-500">
            Accede o crea tu cuenta para empezar.
          </p>
        </div>

        <form className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>

          {searchParams.error && (
            <p className="text-sm text-red-600">{searchParams.error}</p>
          )}
          {searchParams.message && (
            <p className="text-sm text-emerald-600">{searchParams.message}</p>
          )}

          <div className="flex gap-2">
            <button
              formAction={login}
              className="flex-1 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              Entrar
            </button>
            <button
              formAction={signup}
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100"
            >
              Crear cuenta
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
