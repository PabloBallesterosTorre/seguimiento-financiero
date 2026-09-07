import Link from "next/link";
import { requestPasswordReset } from "../actions";
import { inputClass, labelClass, btnPrimaryClass } from "@/components/formStyles";

export default async function RecuperarPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-page px-4">
      <div className="w-full max-w-sm space-y-6 rounded-card border border-border bg-surface p-8 shadow-card">
        <div className="text-center">
          <h1 className="font-sora text-2xl font-bold text-ink">Recuperar contraseña</h1>
          <p className="mt-1.5 text-[13px] text-ink-secondary">
            Te enviamos un enlace a tu email para restablecerla.
          </p>
        </div>

        {message ? (
          <p className="text-center text-[13px] text-success">{message}</p>
        ) : (
          <form className="space-y-4">
            <div>
              <label htmlFor="email" className={labelClass}>
                Email
              </label>
              <input id="email" name="email" type="email" required className={inputClass} />
            </div>

            <button formAction={requestPasswordReset} className={`${btnPrimaryClass} w-full text-center`}>
              Enviar enlace
            </button>
          </form>
        )}

        <p className="text-center text-[13px] text-ink-secondary">
          <Link href="/login" className="font-semibold text-accent">
            Volver a iniciar sesión
          </Link>
        </p>
      </div>
    </main>
  );
}
