import { ActionFunctionArgs, redirect } from "@remix-run/node";
import { handleGoogleAuth, createUserSession } from "~/services/auth.server";

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const profile = JSON.parse(formData.get("profile") as string);
  const accessToken = formData.get("accessToken") as string;
  const refreshToken = formData.get("refreshToken") as string;

  try {
    const userData = await handleGoogleAuth(profile, accessToken, refreshToken);
    return createUserSession(userData, "/dashboard");
  } catch (error) {
    console.error("[auth.google.callback] Erreur lors de l'authentification:", error);
    return redirect("/login?error=auth_failed");
  }
}

// Cette route n'est plus utilisée car auth-direct.tsx gère le callback.
// Laisser un composant vide pour éviter les erreurs 404 si elle est encore appelée.
export default function GoogleCallback() {
  return (
    <div>
      Cette page de callback n'est plus active. Vous devriez être redirigé.
      Si ce n'est pas le cas, veuillez retourner à la page de <a href="/login">connexion</a>.
    </div>
  );
}
