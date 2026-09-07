"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

// Deriva el origen público (para construir la URL de redirección de los emails de
// Supabase Auth) a partir de las cabeceras de la petición, sin depender de una env var
// fija: así funciona igual en local, en producción y en el proyecto Supabase de dev.
async function getOrigin() {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;

  const host = h.get("host")!;
  const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const proto = h.get("x-forwarded-proto") ?? (isLocal ? "http" : "https");
  return `${proto}://${host}`;
}

export async function login(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  redirect("/home");
}

export async function requestPasswordReset(formData: FormData) {
  const supabase = await createClient();
  const email = formData.get("email") as string;
  const origin = await getOrigin();

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirmar?next=/restablecer-password`,
  });

  // No revelamos si el email existe o no en la respuesta (evita enumeración de usuarios).
  redirect(
    "/login/recuperar?message=" +
      encodeURIComponent("Si el email existe, te hemos enviado un enlace para restablecer la contraseña.")
  );
}

