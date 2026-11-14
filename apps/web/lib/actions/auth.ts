"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export type LoginState = { error?: string } | null;

export async function signInAction(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Completa email y contraseña." };
  }

  try {
    await auth.api.signInEmail({ body: { email, password } });
  } catch {
    return { error: "Credenciales incorrectas. Inténtalo de nuevo." };
  }

  redirect("/");
}

export async function signOutAction(): Promise<void> {
  await auth.api.signOut({ headers: await headers() });
  redirect("/login");
}
