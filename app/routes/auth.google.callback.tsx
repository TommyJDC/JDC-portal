/*
import { LoaderFunctionArgs, redirect } from "@remix-run/node";
import { authenticator } from "../services/auth.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    // Authentifier l'utilisateur avec Firebase via le strategy
    const user = await authenticator.authenticate("google", request, {
      successRedirect: "/dashboard",
      failureRedirect: "/login",
    });

    return user;
  } catch (error) {
    console.error("Google callback error:", error);
    return redirect("/login");
  }
};

export default function GoogleCallback() {
  return null; // Cette page ne sera jamais rendue
}
*/

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
