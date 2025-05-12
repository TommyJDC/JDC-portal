import { redirect } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { sessionStorage } from "~/services/session.server";

// Redirect root path ("/") to the dashboard
export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Vérifier si l'utilisateur a une session valide
  const cookieHeader = request.headers.get("Cookie");
  if (cookieHeader) {
    try {
      const session = await sessionStorage.getSession(cookieHeader);
      const userSession = session.get("user");
      if (userSession && userSession.userId) {
        // Si l'utilisateur est connecté, rediriger vers le dashboard
        return redirect("/dashboard");
      }
    } catch (e) {
      console.error("Erreur lors de la vérification de session:", e);
    }
  }
  
  // Si l'utilisateur n'est pas connecté, rediriger vers auth-direct
  return redirect("/auth-direct");
};

// This component should technically never render due to the redirect,
// but it's good practice to have a fallback.
export default function Index() {
  return (
    <div className="p-6 text-center">
      <h1 className="text-xl text-jdc-gray-300">Redirection vers le tableau de bord...</h1>
      {/* You could add a loading spinner here */}
    </div>
  );
}
