import { Link } from "@remix-run/react";

export default function DebugIndex() {
  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-white">Outils de diagnostic</h1>
        <Link to="/" className="text-blue-400 hover:underline">
          Retour à l'accueil
        </Link>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-jdc-blue-darker p-6 rounded-lg border border-jdc-gray-700 hover:border-jdc-yellow transition-colors">
          <h2 className="text-xl font-semibold text-white mb-2">Diagnostic d'authentification</h2>
          <p className="text-jdc-gray-300 mb-4">
            Affiche les informations sur votre session utilisateur, votre profil et l'état d'authentification Firebase.
          </p>
          <Link 
            to="/debug" 
            className="inline-block bg-jdc-blue hover:bg-jdc-blue-light text-white font-medium py-2 px-4 rounded transition-colors"
          >
            Accéder
          </Link>
        </div>
        
        <div className="bg-jdc-blue-darker p-6 rounded-lg border border-jdc-gray-700 hover:border-jdc-yellow transition-colors">
          <h2 className="text-xl font-semibold text-white mb-2">Tester un profil spécifique</h2>
          <p className="text-jdc-gray-300 mb-4">
            Permet de récupérer et d'examiner un profil utilisateur spécifique à partir de Firestore.
          </p>
          <Link 
            to="/debug-profile" 
            className="inline-block bg-jdc-blue hover:bg-jdc-blue-light text-white font-medium py-2 px-4 rounded transition-colors"
          >
            Accéder
          </Link>
        </div>
        
        <div className="bg-jdc-blue-darker p-6 rounded-lg border border-jdc-gray-700 hover:border-jdc-yellow transition-colors">
          <h2 className="text-xl font-semibold text-white mb-2">Corriger le rôle utilisateur</h2>
          <p className="text-jdc-gray-300 mb-4">
            Permet de mettre à jour le rôle d'un utilisateur dans Firestore pour résoudre les problèmes d'accès.
          </p>
          <Link 
            to="/debug-fix-role" 
            className="inline-block bg-jdc-blue hover:bg-jdc-blue-light text-white font-medium py-2 px-4 rounded transition-colors"
          >
            Accéder
          </Link>
        </div>
        
        <div className="bg-jdc-blue-darker p-6 rounded-lg border border-jdc-gray-700 hover:border-jdc-yellow transition-colors">
          <h2 className="text-xl font-semibold text-white mb-2">Composant de débogage</h2>
          <p className="text-jdc-gray-300 mb-4">
            Affiche le composant DebugAuth qui est intégré dans l'application pour le débogage.
          </p>
          <p className="text-jdc-gray-400 text-sm italic">
            Ce composant est visible sur toutes les pages de l'application pendant la phase de débogage.
          </p>
        </div>
      </div>
      
      <div className="mt-8 bg-yellow-900/30 p-6 rounded-lg border border-yellow-800">
        <h2 className="text-xl font-semibold text-white mb-4">Problème du panneau Admin</h2>
        <p className="text-jdc-gray-300 mb-4">
          Si vous ne voyez pas le lien "Admin" dans le header malgré avoir le rôle "Admin", voici les causes possibles et les solutions :
        </p>
        
        <div className="space-y-4">
          <div className="bg-jdc-gray-800/50 p-4 rounded">
            <h3 className="font-medium text-white mb-2">1. Problème de casse du rôle</h3>
            <p className="text-jdc-gray-300">
              Le rôle doit être exactement "Admin" (avec un A majuscule). Utilisez l'outil "Corriger le rôle utilisateur" pour le mettre à jour.
            </p>
          </div>
          
          <div className="bg-jdc-gray-800/50 p-4 rounded">
            <h3 className="font-medium text-white mb-2">2. Problème de synchronisation client/serveur</h3>
            <p className="text-jdc-gray-300">
              L'ID utilisateur côté client (Firebase) doit correspondre à l'ID côté serveur (session). Vérifiez avec l'outil "Diagnostic d'authentification".
            </p>
          </div>
          
          <div className="bg-jdc-gray-800/50 p-4 rounded">
            <h3 className="font-medium text-white mb-2">3. Problème de chargement du profil</h3>
            <p className="text-jdc-gray-300">
              Si le profil n'est pas correctement chargé, le lien Admin ne s'affichera pas. Déconnectez-vous et reconnectez-vous pour résoudre ce problème.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
