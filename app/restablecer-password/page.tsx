import { updatePassword } from "./actions";
import { inputClass, labelClass, btnPrimaryClass } from "@/components/formStyles";

export default async function RestablecerPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-page px-4">
      <div className="w-full max-w-sm space-y-6 rounded-card border border-border bg-surface p-8 shadow-card">
        <div className="text-center">
          <h1 className="font-sora text-2xl font-bold text-ink">Nueva contraseña</h1>
          <p className="mt-1.5 text-[13px] text-ink-secondary">Elige una contraseña nueva para tu cuenta.</p>
        </div>

        <form className="space-y-4">
          <div>
            <label htmlFor="password" className={labelClass}>
              Contraseña nueva
            </label>
            <input id="password" name="password" type="password" required minLength={6} className={inputClass} />
          </div>

          {error && <p className="text-[13px] text-danger">{error}</p>}

          <button formAction={updatePassword} className={`${btnPrimaryClass} w-full text-center`}>
            Guardar contraseña
          </button>
        </form>
      </div>
    </main>
  );
}
