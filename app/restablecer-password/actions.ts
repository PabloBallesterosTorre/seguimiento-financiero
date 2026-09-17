"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { traducirErrorAuth } from "@/lib/erroresAuth";

export async function updatePassword(formData: FormData) {
  const supabase = await createClient();
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    console.error("restablecerPassword", error.message);
    redirect(`/restablecer-password?error=${encodeURIComponent(traducirErrorAuth(error.message))}`);
  }

  await supabase.auth.signOut();
  redirect("/login?message=" + encodeURIComponent("Contraseña actualizada. Inicia sesión de nuevo."));
}
