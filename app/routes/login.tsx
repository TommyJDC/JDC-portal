import { Link } from "@remix-run/react"; // Utiliser Link pour la navigation côté client
// import { redirect } from "@remix-run/node"; // Plus nécessaire pour l'action
// import { authenticator } from "../services/auth.server"; // authenticator n'est plus utilisé ici

// La fonction action n'est plus nécessaire car nous utilisons un lien direct vers /auth-direct
// export const action = async ({ request }: { request: Request }) => {
//   // Cette logique est maintenant gérée par /auth-direct
// };

export default function Login() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-sm space-y-8 rounded-xl bg-ui-surface/80 backdrop-blur-lg p-8 shadow-2xl border border-ui-border/50">
        <div className="text-center">
          <img 
            src="https://www.jdc.fr/images/logo_jdc_blanc.svg" 
            alt="JDC Logo" 
            className="h-12 w-auto mx-auto mb-6"
          />
          <h2 className="text-xl font-semibold text-text-primary">Connexion au Portail JDC</h2>
          <p className="mt-2 text-sm text-text-secondary">
            Veuillez utiliser votre compte Google pour accéder à la plateforme.
          </p>
        </div>
        <div className="mt-8">
          <Link
            to="/auth-direct" 
            className="group relative flex w-full items-center justify-center rounded-md bg-brand-blue py-2.5 px-4 text-sm font-medium text-white hover:bg-brand-blue-dark focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-2 focus:ring-offset-ui-surface/80 transition-colors"
          >
            <svg className="mr-2 h-5 w-5" aria-hidden="true" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 0C4.477 0 0 4.477 0 10s4.477 10 10 10c2.296 0 4.42-.78 6.132-2.068a9.932 9.932 0 00-2.922-4.078 4.5 4.5 0 01-3.21-4.254V7.5h2.5v2.083c.02.06.032.123.056.182A5.002 5.002 0 0010 2a8 8 0 00-8 8c0 1.362.34 2.64.943 3.766a4.47 4.47 0 01-.075-.766A4.5 4.5 0 017.5 7.5V6H5v1.5a4.5 4.5 0 01-4.492 4.492A10.001 10.001 0 0010 20c5.523 0 10-4.477 10-10S15.523 0 10 0zM7.5 13a2.5 2.5 0 100-5 2.5 2.5 0 000 5zm5-2.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" clipRule="evenodd" />
            </svg>
            Se connecter avec Google
          </Link>
        </div>
        <p className="mt-6 text-center text-xs text-text-tertiary">
          En cas de problème, contactez le support JDC.
        </p>
      </div>
    </div>
  );
}
