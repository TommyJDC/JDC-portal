import { json, redirect } from "@remix-run/node"; // Importer redirect
import { useLoaderData } from "@remix-run/react";
import { getGoogleAuthClient, readSheetData } from "~/services/google.server"; // Importer depuis google.server
import { authenticator } from "~/services/auth.server"; // Importer l'authenticator
import type { UserSession } from "~/services/session.server"; // Importer le type UserSession
import { FaTruck, FaInfoCircle, FaBox, FaTag } from 'react-icons/fa'; // Importer des icônes pertinentes

// Définir les indices des colonnes en fonction des en-têtes fournis
const COLUMN_INDICES = {
  service: 0,
  statutCDE: 1,
  agence: 6, // Colonne "Agence" pour le filtrage
  sap1: 9,
  qte1: 10,
  designation1: 11,
  sap2: 12,
  qte2: 13,
  designation2: 14,
  sap3: 15,
  qte3: 16,
  designation3: 17,
  sap4: 18,
  qte4: 19,
  designation4: 20,
  sap5: 21,
  qte5: 22,
  designation5: 23,
};

type LogistiqueItem = {
  service: string;
  statutCDE: string;
  sap1?: string;
  qte1?: string;
  designation1?: string;
  sap2?: string;
  qte2?: string;
  designation2?: string;
  sap3?: string;
  qte3?: string;
  designation3?: string;
  sap4?: string;
  qte4?: string;
  designation4?: string;
  sap5?: string;
  qte5?: string;
  designation5?: string;
};

type LoaderData = {
  data: LogistiqueItem[];
  error?: string; // Ajouter la propriété error
};

export async function loader({ request }: { request: Request }) {
  // Utiliser authenticator.isAuthenticated pour obtenir la session utilisateur
  // Redirige vers /login si l'utilisateur n'est pas authentifié du tout
  const userSession = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });

  // Vérifier si le jeton d'actualisation Google est présent dans la session
  if (!userSession || !userSession.googleRefreshToken) {
     console.error("Jeton d'actualisation Google manquant pour l'utilisateur authentifié.");
     // Rediriger vers l'authentification Google pour forcer la ré-autorisation avec les scopes nécessaires
     // Le paramètre 'reauth=true' peut être utilisé sur la route /auth/google pour forcer le prompt de consentement
     throw redirect("/auth/google?reauth=true");
  }

  let authClient;
  try {
    // Tenter d'obtenir le client d'authentification Google avec les données utilisateur
    // userSession est maintenant garanti d'être UserSession et d'avoir googleRefreshToken
    authClient = await getGoogleAuthClient(userSession);
  } catch (error) {
    console.error("Erreur lors de l'obtention du client d'authentification Google:", error);
    // Gérer les erreurs qui pourraient survenir *après* l'obtention du client d'authentification
    return json({ data: [], error: "Erreur lors de l'obtention du client Google." }, { status: 500 });
  }


  const sheetId = "11D6dysF2smtv37soIjHCzWDi2dE9Xevmt_60oYlvU68";
  // Utiliser le nom de feuille correct "DEMANDE"
  const range = "DEMANDE!A:X"; // Lire toutes les colonnes pertinentes

  try {
    const values = await readSheetData(authClient, sheetId, range); // Utiliser readSheetData de google.server

    if (!values) {
      return json({ data: [], error: "Aucune donnée trouvée." });
    }

    // Filtrer les lignes où la colonne "Agence" est "Grenoble"
    // On saute la première ligne qui contient les en-têtes
    const filteredData = values.slice(1).filter((row: string[]) => { // Ajouter le type string[]
      const agence = row[COLUMN_INDICES.agence];
      return agence && agence.toLowerCase() === "grenoble";
    });

    // Mapper les données filtrées pour extraire les colonnes demandées
    const formattedData: LogistiqueItem[] = filteredData.map((row: string[]) => ({ // Ajouter le type string[] et LogistiqueItem[]
      service: row[COLUMN_INDICES.service] || '',
      statutCDE: row[COLUMN_INDICES.statutCDE] || '',
      sap1: row[COLUMN_INDICES.sap1],
      qte1: row[COLUMN_INDICES.qte1],
      designation1: row[COLUMN_INDICES.designation1],
      sap2: row[COLUMN_INDICES.sap2],
      qte2: row[COLUMN_INDICES.qte2],
      designation2: row[COLUMN_INDICES.designation2],
      sap3: row[COLUMN_INDICES.sap3],
      qte3: row[COLUMN_INDICES.qte3],
      designation3: row[COLUMN_INDICES.designation3],
      sap4: row[COLUMN_INDICES.sap4],
      qte4: row[COLUMN_INDICES.qte4],
      designation4: row[COLUMN_INDICES.designation4],
      sap5: row[COLUMN_INDICES.sap5],
      qte5: row[COLUMN_INDICES.qte5],
      designation5: row[COLUMN_INDICES.designation5],
    }));

    return json({ data: formattedData });

  } catch (error) {
    console.error("Erreur lors du chargement des données de la feuille:", error);
    // Inclure le message d'erreur spécifique pour faciliter le débogage
    return json({ data: [], error: `Erreur lors du chargement des données de la feuille: ${error instanceof Error ? error.message : String(error)}` });
  }
}

// Fonction pour déterminer la couleur du badge en fonction du statut CDE
const getStatutColor = (statut: string | undefined): string => {
  if (!statut) return 'bg-gray-600 text-gray-100'; // Couleur par défaut si le statut est vide
  const lowerStatut = statut?.toLowerCase(); // Utiliser ?. pour éviter l'erreur si statut est undefined
  switch (lowerStatut) {
    case 'expédiée':
      return 'bg-green-600 text-green-100';
    case 'annulée':
      return 'bg-red-600 text-red-100';
    case 'préparation':
      return 'bg-orange-600 text-orange-100';
    case 'validée':
      return 'bg-blue-600 text-blue-100';
    default:
      return 'bg-gray-600 text-gray-100'; // Couleur par défaut pour les statuts inconnus
  }
};


export default function LogistiqueGrenoble() {
  const { data, error } = useLoaderData<LoaderData>(); // Utiliser le type LoaderData

  if (error) {
    return <div className="text-red-500 p-4">Erreur: {error}</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4 text-white">Suivie demande de RMA Grenoble</h1>
      {data.length === 0 ? (
        <p className="text-gray-400">Aucune donnée trouvée pour Grenoble.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4"> {/* Changé en liste verticale */}
          {data.map((item: LogistiqueItem, index: number) => {
            const statutColorClass = getStatutColor(item.statutCDE);
            // Déterminer la couleur de la bordure en hexadécimal
            let borderColor = '#4b5563'; // Default: gray-600 from getStatutColor default
            if (statutColorClass.includes('bg-green-600')) borderColor = '#10b981'; // green-600
            else if (statutColorClass.includes('bg-red-600')) borderColor = '#ef4444'; // red-600
            else if (statutColorClass.includes('bg-orange-600')) borderColor = '#f97316'; // orange-600
            else if (statutColorClass.includes('bg-blue-600')) borderColor = '#3b82f6'; // blue-600

            return (
              <div
                key={index}
                className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg shadow-lg p-4 cursor-pointer hover:shadow-xl hover:from-gray-700 hover:to-gray-800 transition-all duration-200 flex flex-col space-y-3 border-l-4" // Appliquer le style de carte complet
                style={{ borderLeftColor: borderColor }} // Bordure colorée selon le statut
                // Ajouter un onClick si on veut ouvrir les détails (non spécifié dans la tâche)
                // onClick={() => handleItemClick(item)}
                role="button" // Optionnel si cliquable
                tabIndex={0} // Optionnel si cliquable
              >
                {/* Header */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center min-w-0">
                    <FaTruck className="mr-2 text-jdc-yellow flex-shrink-0" />
                    <span className="text-white font-semibold text-base mr-2 truncate" title={item.service}>Service: {item.service}</span>
                  </div>
                  <span
                    className={`ml-2 flex-shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statutColorClass}`} // Utiliser la classe de statut
                    title={`Statut CDE: ${item.statutCDE || 'N/A'}`}
                  >
                     <FaInfoCircle className="mr-1" />
                    {item.statutCDE || 'N/A'}
                  </span>
                </div>

                {/* Body: Articles */}
                <div className="grid grid-cols-1 gap-2 text-xs text-gray-400 mt-2"> {/* Ajout de marge supérieure */}
                  {/* En-tête de la section Articles */}
                  <div className="flex items-center text-white font-medium mb-1">
                     <FaBox className="mr-2 text-gray-500 w-4 flex-shrink-0" />
                     <span>Articles:</span>
                  </div>

                  {/* Liste des articles SAP */}
                  {item.sap1 && (
                    <div className="flex flex-col space-y-1 border-b border-gray-700 pb-2"> {/* Conteneur pour chaque article */}
                      <div className="flex items-center text-white font-medium"> {/* SAP number and Designation */}
                        <FaTag className="mr-2 text-gray-500 w-4 flex-shrink-0" />
                        <span>SAP 1: {item.sap1} - {item.designation1 || 'N/A'}</span> {/* Combine SAP and Designation */}
                      </div>
                      <div className="pl-6 text-gray-400"> {/* Quantity below */}
                        <p><strong className="text-gray-500">Qté:</strong> {item.qte1 || 'N/A'}</p>
                      </div>
                    </div>
                  )}
                   {item.sap2 && (
                    <div className="flex flex-col space-y-1 border-b border-gray-700 pb-2">
                       <div className="flex items-center text-white font-medium">
                         <FaTag className="mr-2 text-gray-500 w-4 flex-shrink-0" />
                         <span>SAP 2: {item.sap2} - {item.designation2 || 'N/A'}</span>
                      </div>
                      <div className="pl-6 text-gray-400">
                        <p><strong className="text-gray-500">Qté:</strong> {item.qte2 || 'N/A'}</p>
                      </div>
                    </div>
                  )}
                  {item.sap3 && (
                    <div className="flex flex-col space-y-1 border-b border-gray-700 pb-2">
                       <div className="flex items-center text-white font-medium">
                         <FaTag className="mr-2 text-gray-500 w-4 flex-shrink-0" />
                         <span>SAP 3: {item.sap3} - {item.designation3 || 'N/A'}</span>
                      </div>
                      <div className="pl-6 text-gray-400">
                        <p><strong className="text-gray-500">Qté:</strong> {item.qte3 || 'N/A'}</p>
                      </div>
                    </div>
                  )}
                  {item.sap4 && (
                    <div className="flex flex-col space-y-1 border-b border-gray-700 pb-2">
                       <div className="flex items-center text-white font-medium">
                         <FaTag className="mr-2 text-gray-500 w-4 flex-shrink-0" />
                         <span>SAP 4: {item.sap4} - {item.designation4 || 'N/A'}</span>
                      </div>
                      <div className="pl-6 text-gray-400">
                        <p><strong className="text-gray-500">Qté:</strong> {item.qte4 || 'N/A'}</p>
                      </div>
                    </div>
                  )}
                  {item.sap5 && (
                    <div className="flex flex-col space-y-1 border-b border-gray-700 pb-2">
                       <div className="flex items-center text-white font-medium">
                         <FaTag className="mr-2 text-gray-500 w-4 flex-shrink-0" />
                         <span>SAP 5: {item.sap5} - {item.designation5 || 'N/A'}</span>
                      </div>
                      <div className="pl-6 text-gray-400">
                        <p><strong className="text-gray-500">Qté:</strong> {item.qte5 || 'N/A'}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer - Pas de champs spécifiques demandés, on peut laisser vide ou ajouter autre chose si pertinent */}
                <div className="border-t border-gray-700 pt-2 mt-2 space-y-1 text-xs text-gray-400">
                  {/* Ajoutez d'autres champs pertinents ici si nécessaire */}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
