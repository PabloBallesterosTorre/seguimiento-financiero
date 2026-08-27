import { login } from "./actions";
import { inputClass, labelClass, btnPrimaryClass } from "@/components/formStyles";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-page px-4">
      <div className="w-full max-w-sm space-y-6 rounded-card border border-border bg-surface p-8 shadow-card">
        <div className="text-center">
          <h1 className="font-sora text-2xl font-bold text-ink">Seguimiento Financiero</h1>
          <p className="mt-1.5 text-[13px] text-ink-secondary">Accede a tu cuenta.</p>
        </div>

        <form className="space-y-4">
          <div>
            <label htmlFor="email" className={labelClass}>
              Email
            </label>
            <input id="email" name="email" type="email" required className={inputClass} />
          </div>

          <div>
            <label htmlFor="password" className={labelClass}>
              Contraseña
            </label>
            <input id="password" name="password" type="password" required minLength={6} className={inputClass} />
          </div>

          {error && <p className="text-[13px] text-danger">{error}</p>}
          {message && <p className="text-[13px] text-success">{message}</p>}

          <button formAction={login} className={`${btnPrimaryClass} w-full text-center`}>
            Entrar
          </button>
        </form>
      </div>
    </main>
  );
}
