import { json, redirect } from "@remix-run/node"; 
import type { LoaderFunctionArgs } from "@remix-run/node"; // Utiliser LoaderFunctionArgs
import { useLoaderData } from "@remix-run/react";
import { getGoogleAuthClient, readSheetData } from "~/services/google.server"; 
// import { authenticator } from "~/services/auth.server"; // Plus utilisé directement
import { sessionStorage, type UserSessionData } from "~/services/session.server"; // Importer pour session manuelle
import { FaTruck, FaInfoCircle, FaBox, FaTag, FaExclamationTriangle } from 'react-icons/fa'; // Ajout de FaExclamationTriangle

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
  error?: string; 
};

export async function loader({ request }: LoaderFunctionArgs) { // Utiliser LoaderFunctionArgs
  const sessionCookie = request.headers.get("Cookie");
  const sessionStore = await sessionStorage.getSession(sessionCookie);
  const userSession: UserSessionData | null = sessionStore.get("user") ?? null;

  if (!userSession || !userSession.userId) {
    throw redirect("/login"); // Rediriger si non authentifié
  }

  // Vérifier si le jeton d'actualisation Google est présent dans la session
  if (!userSession.googleRefreshToken) {
     console.error("Jeton d'actualisation Google manquant pour l'utilisateur authentifié.");
     // Rediriger vers la page de connexion, qui mènera à /auth-direct pour une nouvelle authentification
     throw redirect("/login?error=google_token_refresh_needed");
  }

  let authClient;
  try {
    // Tenter d'obtenir le client d'authentification Google avec les données utilisateur
    authClient = await getGoogleAuthClient(userSession); // userSession est UserSessionData
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
const getStatutColorClasses = (statut: string | undefined): { badge: string; borderVar: string } => {
  if (!statut) return { badge: 'bg-ui-background text-text-tertiary border border-ui-border', borderVar: 'var(--color-ui-border)'};
  const lowerStatut = statut?.toLowerCase();
  switch (lowerStatut) {
    case 'expédiée':
      return { badge: 'bg-green-500/10 text-green-700 border border-green-500/30', borderVar: 'var(--color-green-500)' };
    case 'annulée':
      return { badge: 'bg-red-500/10 text-red-700 border border-red-500/30', borderVar: 'var(--color-red-500)' };
    case 'préparation':
      return { badge: 'bg-yellow-500/10 text-yellow-700 border border-yellow-500/30', borderVar: 'var(--color-yellow-500)' };
    case 'validée':
      return { badge: 'bg-brand-blue/20 text-brand-blue-light border border-brand-blue/30', borderVar: 'var(--color-brand-blue)' };
    default:
      return { badge: 'bg-ui-background text-text-tertiary border border-ui-border', borderVar: 'var(--color-ui-border)' };
  }
};


export default function LogistiqueGrenoble() {
  const { data, error } = useLoaderData<LoaderData>();

  if (error) {
    return (
      <div className="p-4 md:p-6">
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-4 rounded-md shadow-md">
          <div className="flex items-center mb-2">
            <FaExclamationTriangle className="h-5 w-5 mr-2 text-red-400" />
            <p className="font-semibold text-red-200">Erreur lors du chargement des données :</p>
          </div>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-semibold text-text-primary flex items-center">
        <FaTruck className="mr-3 text-brand-blue h-6 w-6" />
        Suivi Demande RMA Grenoble
      </h1>
      {data.length === 0 ? (
        <div className="text-center py-10 text-text-secondary bg-ui-surface rounded-lg shadow-md border border-ui-border">
          <FaBox className="mx-auto text-4xl mb-3 opacity-40" />
          <p>Aucune donnée trouvée pour Grenoble.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map((item: LogistiqueItem, index: number) => {
            const { badge: statutBadgeClass, borderVar: itemBorderColorVar } = getStatutColorClasses(item.statutCDE);
            
            return (
              <div
                key={index}
                className="bg-ui-surface rounded-lg shadow-md p-4 flex flex-col space-y-3 border-l-4 hover:shadow-lg transition-shadow"
                style={{ borderLeftColor: itemBorderColorVar }}
              >
                {/* Header */}
                <div className="flex justify-between items-start">
                  <div className="flex items-center min-w-0">
                    <FaTruck className="mr-2.5 text-brand-blue flex-shrink-0 text-lg" />
                    <span className="text-text-primary font-semibold text-base mr-2 truncate" title={item.service}>
                      {item.service || "Service N/A"}
                    </span>
                  </div>
                  <span
                    className={`ml-2 flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statutBadgeClass}`}
                    title={`Statut CDE: ${item.statutCDE || 'N/A'}`}
                  >
                     <FaInfoCircle className="mr-1" />
                    {item.statutCDE || 'N/A'}
                  </span>
                </div>

                {/* Body: Articles */}
                <div className="space-y-2 text-xs text-text-secondary pt-2 border-t border-ui-border/50">
                  <div className="flex items-center text-text-primary font-medium mb-1 text-sm">
                     <FaBox className="mr-2 text-text-tertiary w-4 flex-shrink-0" />
                     <span>Articles:</span>
                  </div>

                  {[1, 2, 3, 4, 5].map(num => {
                    const sap = item[`sap${num}` as keyof LogistiqueItem] as string | undefined;
                    const designation = item[`designation${num}` as keyof LogistiqueItem] as string | undefined;
                    const qte = item[`qte${num}` as keyof LogistiqueItem] as string | undefined;

                    if (!sap && !designation) return null; // Ne rien afficher si SAP et désignation sont vides

                    return (
                      <div key={num} className="pl-1 border-b border-ui-border/30 pb-1.5 last:border-b-0 last:pb-0">
                        <div className="flex items-center text-text-primary font-medium text-xs">
                          <FaTag className="mr-1.5 text-text-tertiary w-3.5 flex-shrink-0" />
                          <span className="truncate" title={`${sap || 'N/A'} - ${designation || 'N/A'}`}>
                            {sap || 'N/A'} - {designation || 'N/A'}
                          </span>
                        </div>
                        {qte && (
                          <div className="pl-5 text-text-secondary text-xs">
                            <p><strong className="text-text-tertiary font-normal">Qté:</strong> {qte}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                   {![item.sap1, item.sap2, item.sap3, item.sap4, item.sap5].some(Boolean) && (
                     <p className="pl-1 text-xs text-text-tertiary italic">Aucun article listé.</p>
                   )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
