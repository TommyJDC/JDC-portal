import { Link } from "@remix-run/react"; // Utiliser Link pour la navigation côté client
// import { redirect } from "@remix-run/node"; // Plus nécessaire pour l'action
// import { authenticator } from "../services/auth.server"; // authenticator n'est plus utilisé ici

// La fonction action n'est plus nécessaire car nous utilisons un lien direct vers /auth-direct
// export const action = async ({ request }: { request: Request }) => {
//   // Cette logique est maintenant gérée par /auth-direct
// };

export default function Login() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-jdc-black">
      <div className="w-full max-w-md space-y-6 rounded-lg bg-jdc-card p-6 shadow-xl border border-jdc-yellow/30">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-jdc-yellow">Connexion</h2>
          <p className="mt-2 text-sm text-jdc-gray-300">
            Utilisez votre compte Google pour vous connecter
          </p>
        </div>
        <div className="mt-6 space-y-6">
          <Link
            to="/auth-direct" // Lien vers la route qui initie l'authentification Google manuelle
            className="group relative flex w-full justify-center rounded-md border border-jdc-yellow bg-jdc-yellow py-2 px-4 text-sm font-semibold text-jdc-black hover:bg-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 focus:ring-offset-jdc-card"
          >
            Se connecter avec Google
          </Link>
        </div>
      </div>
    </div>
  );
}
