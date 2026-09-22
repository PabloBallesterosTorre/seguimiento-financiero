import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { estadoInvitacion, normalizarCodigo, type Invitacion } from "@/lib/invitaciones";
import { registrarConInvitacion } from "./actions";
import { inputClass, labelClass, btnPrimaryClass } from "@/components/formStyles";

const CAMPOS_INVITACION =
  "id, codigo, email, nota, creada_en, caduca_en, reservada_en, usada_por, usada_en";

// Busca la invitación solo para decidir qué enseñar (a qué email va, o si ya no sirve).
// Quien decide de verdad es la server action, que lo vuelve a comprobar todo: esto es
// presentación, no control de acceso.
async function buscarInvitacion(codigo: string): Promise<Invitacion | null> {
  if (!codigo) return null;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("invitaciones")
      .select(CAMPOS_INVITACION)
      .eq("codigo", codigo)
      .maybeSingle<Invitacion>();

    if (error) {
      console.error("registro: buscar invitación", error.message);
      return null;
    }
    return data;
  } catch (e) {
    // Sin SUPABASE_SERVICE_ROLE_KEY configurada, `createAdminClient` lanza. La pantalla
    // sigue cargando (y el formulario dirá el problema al enviarlo) en vez de romperse.
    console.error("registro: cliente admin no disponible", e);
    return null;
  }
}

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-page px-4">
      <div className="w-full max-w-sm space-y-6 rounded-card border border-border bg-surface p-8 shadow-card">
        {children}
      </div>
    </main>
  );
}

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <Marco>
      <div className="text-center">
        <h1 className="font-sora text-2xl font-bold text-ink">{titulo}</h1>
        <p className="mt-2 text-[13px] text-ink-secondary">{texto}</p>
      </div>
      <p className="text-center text-[13px] text-ink-secondary">
        <Link href="/login" className="font-semibold text-accent">
          Ir al acceso
        </Link>
      </p>
    </Marco>
  );
}

export default async function RegistroPage({
  searchParams,
}: {
  searchParams: Promise<{ codigo?: string; email?: string; error?: string }>;
}) {
  const params = await searchParams;
  const codigo = normalizarCodigo(params.codigo ?? "");
  const error = params.error;

  const invitacion = await buscarInvitacion(codigo);
  const estado = invitacion ? estadoInvitacion(invitacion, new Date()) : null;

  if (estado === "usada") {
    return (
      <Aviso
        titulo="Invitación ya usada"
        texto="Esta invitación se canjeó en su día. Si la cuenta es tuya, entra con tu contraseña."
      />
    );
  }

  if (estado === "caducada") {
    return (
      <Aviso
        titulo="Invitación caducada"
        texto="Este enlace ya no sirve. Pídele una invitación nueva a quien te envió esta."
      />
    );
  }

  // El email de la invitación manda. Solo se deja escribir cuando no hay invitación
  // localizada (código vacío o equivocado): así nadie puede darse de alta con un email
  // distinto del invitado por descuido, y quien se ha equivocado de código sí puede
  // corregirlo sin perder lo que ya había escrito.
  const emailInvitado = invitacion?.email ?? params.email ?? "";
  const emailBloqueado = Boolean(invitacion);

  return (
    <Marco>
      <div className="text-center">
        <h1 className="font-sora text-2xl font-bold text-ink">Crea tu cuenta</h1>
        <p className="mt-1.5 text-[13px] text-ink-secondary">
          {invitacion
            ? "Elige una contraseña y empieza a usar la app."
            : "El alta es solo por invitación: necesitas un código."}
        </p>
      </div>

      <form className="space-y-4">
        <div>
          <label htmlFor="codigo" className={labelClass}>
            Código de invitación
          </label>
          <input
            id="codigo"
            name="codigo"
            required
            defaultValue={codigo}
            placeholder="A7K2-MQ4X-9BHP"
            autoComplete="off"
            spellCheck={false}
            className={`${inputClass} font-mono uppercase tracking-wider`}
          />
        </div>

        <div>
          <label htmlFor="email" className={labelClass}>
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            defaultValue={emailInvitado}
            readOnly={emailBloqueado}
            className={`${inputClass} ${emailBloqueado ? "cursor-not-allowed text-ink-secondary" : ""}`}
          />
          {emailBloqueado && (
            <p className="mt-1.5 text-xs text-ink-tertiary">
              La invitación es para este email. Si no es el tuyo, pide una nueva.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="password" className={labelClass}>
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            className={inputClass}
          />
          <p className="mt-1.5 text-xs text-ink-tertiary">Al menos 6 caracteres.</p>
        </div>

        <div>
          <label htmlFor="password2" className={labelClass}>
            Repite la contraseña
          </label>
          <input
            id="password2"
            name="password2"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            className={inputClass}
          />
        </div>

        {error && <p className="text-[13px] text-danger">{error}</p>}

        <button formAction={registrarConInvitacion} className={`${btnPrimaryClass} w-full text-center`}>
          Crear cuenta
        </button>
      </form>

      <p className="text-center text-[13px] text-ink-secondary">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-semibold text-accent">
          Entra aquí
        </Link>
      </p>
    </Marco>
  );
}
