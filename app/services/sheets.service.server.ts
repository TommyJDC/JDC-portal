import { google } from 'googleapis';
import type { HeuresDraft } from './firestore.service.server'; // Importer le type de données

/**
 * Met à jour une Google Sheet avec les données de déclaration d'heures.
 * @param accessToken - Le token d'accès Google de l'utilisateur.
 * @param fileId - L'ID de la Google Sheet cible.
 * @param data - Les données du formulaire de déclaration d'heures.
 * @returns Promise<void>
 */
export async function updateHeuresSheet(accessToken: string, fileId: string, data: HeuresDraft['data']): Promise<void> {
  // Initialiser le client Google Sheets API avec le token d'accès
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const sheets = google.sheets({ version: 'v4', auth });

  // --- Déterminer la plage de cellules et le format des données ---
  // ATTENTION: Cette partie dépend FORTEMENT de la structure exacte de votre Google Sheet.
  // Vous devrez ajuster les plages et le mappage des données en fonction de votre feuille.
  // Hypothèse simple: Écrire les données dans une feuille nommée "Déclaration"
  // et mapper les champs à des cellules spécifiques.

  const sheetName = 'Déclaration'; // Nom de la feuille cible
  const requests = [];

  // Exemple de mappage (à adapter):
  // Informations générales
  requests.push({
    range: `${sheetName}!B2`, // Cellule pour le Nom (exemple)
    values: [[data.nom]],
  });
  requests.push({
    range: `${sheetName}!B3`, // Cellule pour le Prénom (exemple)
    values: [[data.prenom]],
  });
  requests.push({
    range: `${sheetName}!B4`, // Cellule pour l'Établissement (exemple)
    values: [[data.etablissement]],
  });

  // Horaires des jours de la semaine (exemple: commencer à la ligne 7, colonne B)
  let row = 7;
  data.horaires.forEach((h: any) => {
    requests.push({ range: `${sheetName}!B${row}`, values: [[h.departDomicile]] }); // Départ Domicile
    requests.push({ range: `${sheetName}!C${row}`, values: [[h.arriveeAgence]] }); // Arrivée Agence
    requests.push({ range: `${sheetName}!D${row}`, values: [[h.pause]] }); // Pause Repas
    requests.push({ range: `${sheetName}!E${row}`, values: [[h.repas]] }); // Indemnisation Repas
    requests.push({ range: `${sheetName}!F${row}`, values: [[h.departAgence]] }); // Départ Agence
    requests.push({ range: `${sheetName}!G${row}`, values: [[h.arriveeDomicile]] }); // Arrivée Domicile
    requests.push({ range: `${sheetName}!H${row}`, values: [[h.jourType]] }); // Type de Jour
    requests.push({ range: `${sheetName}!I${row}`, values: [[h.dureeTravail]] }); // Durée de Travail
    row++;
  });

  // Section Samedi (exemple: ligne 13)
  requests.push({ range: `${sheetName}!B13`, values: [[data.samedi.departDomicile]] });
  requests.push({ range: `${sheetName}!C13`, values: [[data.samedi.arriveeAgence]] });
  requests.push({ range: `${sheetName}!D13`, values: [[data.samedi.pause]] });
  requests.push({ range: `${sheetName}!E13`, values: [[data.samedi.repas]] });
  requests.push({ range: `${sheetName}!F13`, values: [[data.samedi.departAgence]] });
  requests.push({ range: `${sheetName}!G13`, values: [[data.samedi.arriveeDomicile]] });
  requests.push({ range: `${sheetName}!I13`, values: [[data.samedi.dureeTravail]] });

  // Astreinte et Commentaire (exemple: ligne 15 et 16)
  requests.push({ range: `${sheetName}!B15`, values: [[data.astreinteTotalHeures]] });
  requests.push({ range: `${sheetName}!B16`, values: [[data.commentaire]] });


  // Exécuter les requêtes de mise à jour par lots
  try {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: fileId,
      requestBody: {
        valueInputOption: 'USER_ENTERED', // ou 'RAW'
        data: requests,
      },
    });
    console.log(`Feuille Google Sheet ${fileId} mise à jour avec succès.`);
  } catch (error) {
    console.error(`Erreur lors de la mise à jour de la feuille ${fileId}:`, error);
    throw new Error(`Impossible de mettre à jour la Google Sheet: ${error instanceof Error ? error.message : String(error)}`);
  }
}
