import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Link, useFetcher } from "@remix-run/react";
import { authenticator } from "~/services/auth.server";
import { getGoogleAuthClient, readSheetData, writeSheetData } from "~/services/google.server";
import { useState, useEffect, useMemo } from "react";
import InstallationTabacTile from "~/components/InstallationTabacTile";
import { getFirestore } from "firebase-admin/firestore";

interface ActionData {
  success?: boolean;
  error?: string;
}

interface Installation {
  dateSignatureCde: string;
  dateCdeMateriel: string;
  ca: string;
  codeClient: string;
  nom: string;
  ville: string;
  telephone: string;
  commercial: string;
  materiel: string;
  balance: string;
  offreTpe: string;
  cdc: string;
  jdc: string;
  tech: string;
  dateInstall: string;
  nouvelleInstallRenouvellement: string;
  commentaire: string;
  etatMateriel: string;
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
    const range = `${TABAC_SHEET_NAME}!N${rowNumber}:R${rowNumber}`;
    await writeSheetData(authClient, TABAC_SPREADSHEET_ID, range, [JSON.parse(values as string)]);
    
    return json({ success: true });
  } catch (error: any) {
    console.error("[installations.tabac Action] Error:", error);
    return json({ error: error.message }, { status: 500 });
  }
};

// --- Configuration for Tabac Sheet ---
const TABAC_SPREADSHEET_ID = "1Ggm5rnwGmn40JjSN7aB6cs7z-hJiEkdAZLUq6QaQvjg";
const TABAC_SHEET_NAME = "EN COURS";
const TABAC_DATA_RANGE = `${TABAC_SHEET_NAME}!A:R`;
const EDITABLE_COLUMNS = ['N', 'O', 'P', 'Q', 'R'];
const EDITABLE_COL_INDICES = [13, 14, 15, 16, 17];
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
    // Récupérer les données Tabac
    const authClient = await getGoogleAuthClient(session);
    const sheetValues = await readSheetData(authClient, TABAC_SPREADSHEET_ID, TABAC_DATA_RANGE);

    if (!sheetValues || sheetValues.length === 0) {
      return json<SheetLoaderData>({ headers: [], rows: [], error: "Aucune donnée trouvée dans la feuille." });
    }

    // Récupérer les envois CTN pour le secteur Tabac
    const db = getFirestore();
    const ctnSnapshot = await db.collection('Envoi')
      .where('secteur', '==', 'Tabac')
      .get();
    
    const ctnData: CTNData[] = ctnSnapshot.docs.map(doc => {
      const date = doc.data().dateCreation?.toDate() || new Date();
      const rawCodeClient = doc.data().codeClient;
      // Nettoyer le code client : supprimer les espaces et mettre en majuscules
      const cleanedCodeClient = rawCodeClient ? String(rawCodeClient).trim().toUpperCase() : '';
      return {
        codeClient: cleanedCodeClient,
        dateCreation: date.toISOString(),
        secteur: doc.data().secteur || 'Tabac'
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
    console.error("[installations.tabac Loader] Error:", error);
    if (error.message.includes("token") || error.message.includes("authenticate")) {
      return redirect("/auth/google?error=token_error");
    }
    return json<SheetLoaderData>({ 
      headers: [], 
      rows: [], 
      error: error.message || "Erreur lors du chargement des données Tabac." 
    }, { status: 500 });
  }
};

// --- Component ---
export default function TabacInstallations() {
  const { headers, rows, ctnData, error, warning } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<ActionData>();

  // Convertir les données en format Installation
  const installations = useMemo(() => {
    return rows.map(row => {
      const baseInstallation = {
        dateSignatureCde: row[0] || '',
        dateCdeMateriel: row[1] || '',
        ca: row[2] || '',
        codeClient: row[3] || '',
        nom: row[4] || '',
        ville: row[5] || '',
        telephone: row[6] || '',
        commercial: row[7] || '',
        materiel: row[8] || '',
        balance: row[9] || '',
        offreTpe: row[10] || '',
        cdc: row[11] || '',
        jdc: row[12] || '',
        tech: row[13] || '',
        dateInstall: row[14] || '',
        nouvelleInstallRenouvellement: row[15] || '',
        commentaire: row[16] || '',
        etatMateriel: row[17] || ''
      };

      // Vérifier si un CTN existe pour cette installation (après nettoyage du code client)
      const cleanedInstallationCode = baseInstallation.codeClient.trim().toUpperCase();
      const hasCTN = ctnData?.some(ctn => ctn.codeClient === cleanedInstallationCode);
      
      // Si pas de CTN, ajouter une note dans le commentaire
      if (!hasCTN && !baseInstallation.commentaire.includes('CTN non envoyé')) {
        baseInstallation.commentaire = baseInstallation.commentaire
          ? `${baseInstallation.commentaire} | CTN non envoyé`
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
      values.nouvelleInstallRenouvellement,
      values.commentaire,
      values.etatMateriel
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
      <h1 className="text-2xl font-semibold text-white">Installations Tabac (Feuille: {TABAC_SHEET_NAME})</h1>

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
            <InstallationTabacTile
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
