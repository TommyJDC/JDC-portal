import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Link, useFetcher } from "@remix-run/react";
import { authenticator } from "~/services/auth.server";
import { getGoogleAuthClient, readSheetData, writeSheetData } from "~/services/google.server";
import { useState, useEffect, useMemo } from "react";
import InstallationCHRTile from "~/components/InstallationCHRTile";
import { getFirestore } from "firebase-admin/firestore";

interface ActionData {
  success?: boolean;
  error?: string;
}

interface Installation {
  dateCdeMateriel: string;
  ca: string;
  codeClient: string;
  nom: string;
  ville: string;
  telephone: string;
  commercial: string;
  materiel: string;
  cdc: string;
  integrationJalia: string;
  dossier: string;
  tech: string;
  dateInstall: string;
  heure: string;
  relanceProg: string;
  commentaireTech: string;
  materielLivre: string;
  commentaireEnvoi: string;
  bt: string;
  techSecu: string;
  techAffecte: string;
}

interface CTNData {
  codeClient: string;
  dateCreation: string;
  secteur: string;
}

// Action pour la sauvegarde
export const action = async ({ request }: ActionFunctionArgs): Promise<Response> => {
  const session = await authenticator.isAuthenticated(request);
  if (!session) {
    return json({ error: "Non authentifié" }, { status: 401 });
  }

  const formData = await request.formData();
  const rowNumber = formData.get("rowNumber");
  const values = formData.get("values");

  if (!rowNumber || !values) {
    return json({ error: "Données manquantes" }, { status: 400 });
  }

  try {
    const authClient = await getGoogleAuthClient(session);
    const range = `${CHR_SHEET_NAME}!M${rowNumber}:U${rowNumber}`;
    await writeSheetData(authClient, CHR_SPREADSHEET_ID, range, [JSON.parse(values as string)]);
    
    return json({ success: true });
  } catch (error: any) {
    console.error("[installations.chr Action] Error:", error);
    return json({ error: error.message }, { status: 500 });
  }
};

// --- Configuration for CHR Sheet ---
const CHR_SPREADSHEET_ID = "1vnyvpP8uGw0oa9a4j-KI8IUXdc4wW52n_TiQOedw4hk";
const CHR_SHEET_NAME = "EN COURS";
const CHR_DATA_RANGE = `${CHR_SHEET_NAME}!A:U`;
const EDITABLE_COLUMNS = ['M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U'];
const EDITABLE_COL_INDICES = [12, 13, 14, 15, 16, 17, 18, 19, 20];
// --- End Configuration ---

interface SheetLoaderData {
  headers: string[];
  rows: any[][];
  error?: string;
  warning?: string;
  ctnData?: CTNData[];
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const session = await authenticator.isAuthenticated(request);
  if (!session) {
    return redirect("/?error=unauthenticated");
  }

  try {
    // Récupérer les données CHR
    const authClient = await getGoogleAuthClient(session);
    const sheetValues = await readSheetData(authClient, CHR_SPREADSHEET_ID, CHR_DATA_RANGE);

    if (!sheetValues || sheetValues.length === 0) {
      return json<SheetLoaderData>({ headers: [], rows: [], error: "Aucune donnée trouvée dans la feuille." });
    }

    // Récupérer les envois CTN pour le secteur CHR
    const db = getFirestore();
    const ctnSnapshot = await db.collection('Envoi')
      .where('secteur', '==', 'CHR')
      .get();
    
    const ctnData: CTNData[] = ctnSnapshot.docs.map(doc => {
      const date = doc.data().dateCreation?.toDate() || new Date();
      const rawCodeClient = doc.data().codeClient;
      // Nettoyer le code client : supprimer les espaces et mettre en majuscules
      const cleanedCodeClient = rawCodeClient ? String(rawCodeClient).trim().toUpperCase() : '';
      return {
        codeClient: cleanedCodeClient,
        dateCreation: date.toISOString(),
        secteur: doc.data().secteur || 'CHR'
      };
    });

    // Assume first row is headers
    const headers = sheetValues[0];
    const rows = sheetValues.slice(1);

    return json<SheetLoaderData>({
      headers,
      rows,
      ctnData
    });

  } catch (error: any) {
    console.error("[installations.chr Loader] Error:", error);
    if (error.message.includes("token") || error.message.includes("authenticate")) {
      return redirect("/auth/google?error=token_error");
    }
    return json<SheetLoaderData>({ 
      headers: [], 
      rows: [], 
      error: error.message || "Erreur lors du chargement des données CHR." 
    }, { status: 500 });
  }
};

// --- Component ---
export default function CHRInstallations() {
  const { headers, rows, ctnData, error, warning } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<ActionData>();

  // Convertir les données en format Installation
  const installations = useMemo(() => {
    return rows.map(row => {
      const baseInstallation = {
        dateCdeMateriel: row[1] || '',
        ca: row[2] || '',
        codeClient: row[3] || '',
        nom: row[4] || '',
        ville: row[5] || '',
        telephone: row[6] || '',
        commercial: row[7] || '',
        materiel: row[8] || '',
        cdc: row[9] || '',
        integrationJalia: row[10] || '',
        dossier: row[11] || '',
        tech: row[12] || '',
        dateInstall: row[13] || '',
        heure: row[14] || '',
        relanceProg: row[15] || '',
        commentaireTech: row[16] || '',
        materielLivre: row[17] || '',
        commentaireEnvoi: row[18] || '',
        bt: row[19] || '',
        techSecu: row[20] || '',
        techAffecte: row[21] || ''
      };

      // Vérifier si un CTN existe pour cette installation (après nettoyage du code client)
      const cleanedInstallationCode = baseInstallation.codeClient.trim().toUpperCase();
      const hasCTN = ctnData?.some(ctn => ctn.codeClient === cleanedInstallationCode);
      
      // Si pas de CTN, ajouter une note dans le commentaire
      if (!hasCTN && !baseInstallation.commentaireEnvoi.includes('CTN non envoyé')) {
        baseInstallation.commentaireEnvoi = baseInstallation.commentaireEnvoi
          ? `${baseInstallation.commentaireEnvoi} | CTN non envoyé`
          : 'CTN non envoyé';
      }

      return baseInstallation;
    });
  }, [rows, ctnData]);

  // Vérifier si une installation a un CTN associé
  const hasCTN = (codeClient: string) => {
    const cleanedCode = codeClient.trim().toUpperCase();
    return ctnData?.some((ctn: CTNData) => ctn.codeClient === cleanedCode) || false;
  };

  const handleSave = async (rowIndex: number, values: any) => {
    const rowNumber = rowIndex + 2;
    const updateValues = [
      values.tech,
      values.dateInstall,
      values.heure,
      values.relanceProg,
      values.commentaireTech,
      values.materielLivre,
      values.commentaireEnvoi,
      values.bt,
      values.techSecu,
      values.techAffecte
    ];

    fetcher.submit(
      {
        rowNumber: rowNumber.toString(),
        values: JSON.stringify(updateValues)
      },
      { method: "post" }
    );
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-white">Installations CHR (Feuille: {CHR_SHEET_NAME})</h1>

      <Link to="/dashboard" className="text-jdc-blue hover:underline">
        &larr; Retour au Tableau de Bord
      </Link>

      {error && (
        <div className="bg-red-900 bg-opacity-50 text-red-300 p-4 rounded-md">
          <p className="font-semibold">Erreur :</p>
          <p>{error}</p>
        </div>
      )}

      {warning && (
        <div className="bg-yellow-900 bg-opacity-70 text-yellow-300 p-4 rounded-md">
          <p className="font-semibold">Attention :</p>
          <p>{warning}</p>
        </div>
      )}

      {!error && installations.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {installations.map((installation, index) => (
            <InstallationCHRTile
              key={index}
              installation={installation}
              hasCTN={hasCTN(installation.codeClient)}
              onSave={(values) => handleSave(index, values)}
            />
          ))}
        </div>
      )}

      {!error && installations.length === 0 && !warning && (
        <p className="text-jdc-gray-400">Aucune donnée à afficher.</p>
      )}
    </div>
  );
}
