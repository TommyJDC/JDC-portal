import { Buffer } from 'node:buffer';
import type * as ExcelJSTypes from 'exceljs'; // Renommer l'import de type
import type { CommercialData, CommercialArticle, CommercialList, CommercialMenu } from './excelGenerator';

let ExcelJS: typeof import('exceljs');

async function ensureExcelJS() {
  if (!ExcelJS) {
    // @ts-ignore: This import is only for server-side
    ExcelJS = await import('exceljs');
  }
}

// Helper function to safely get cell value as string
function getCellValueAsString(cell: ExcelJSTypes.Cell | undefined): string {
  if (!cell || cell.value === null || cell.value === undefined) {
    return '';
  }
  if (typeof cell.value === 'object' && 'richText' in cell.value) {
    // Handle RichTextValue
    return cell.value.richText?.map(rt => rt.text).join('') || '';
  }
  return cell.value.toString();
}

// Helper function to safely get cell value as number
function getCellValueAsNumber(cell: ExcelJSTypes.Cell | undefined): number {
  if (!cell || cell.value === null || cell.value === undefined) {
    return 0;
  }
  const num = Number(cell.value);
  return isNaN(num) ? 0 : num;
}

// Helper function to safely get cell value as 'oui' or 'non'
function getCellValueAsOuiNon(cell: ExcelJSTypes.Cell | undefined): 'oui' | 'non' {
    const value = getCellValueAsString(cell).toLowerCase().trim();
    return value === 'oui' ? 'oui' : 'non';
}


export async function parseMenuFile(file: File): Promise<CommercialData> {
  await ensureExcelJS();
  const buffer = Buffer.from(new Uint8Array(await file.arrayBuffer()));
  const workbook = new ExcelJS.Workbook();
  // @ts-ignore: Bypass type issue with Buffer
  await workbook.xlsx.load(buffer);

  const articles: CommercialArticle[] = [];
  const lists: CommercialList[] = [];
  const menus: CommercialMenu[] = [];

  // --- Parse Feuille ARTICLE ---
  const articleSheet = workbook.getWorksheet('ARTICLE');
  if (articleSheet) {
    // Start from row 2 to skip header
    for (let i = 2; i <= articleSheet.rowCount; i++) {
      const row = articleSheet.getRow(i);
      // Check if the row seems valid (e.g., has a value in the ARTICLE column)
      if (getCellValueAsString(row.getCell('C')).trim()) {
          const article: CommercialArticle = {
            groupe: getCellValueAsString(row.getCell('A')),
            famille: getCellValueAsString(row.getCell('B')),
            article: getCellValueAsString(row.getCell('C')),
            prix1: getCellValueAsNumber(row.getCell('D')),
            prix2: getCellValueAsNumber(row.getCell('E')),
            tva: getCellValueAsString(row.getCell('F')),
            impression: getCellValueAsString(row.getCell('G')),
            liste: getCellValueAsOuiNon(row.getCell('H')),
          };
          articles.push(article);
      }
    }
  } else {
    console.warn("Feuille 'ARTICLE' non trouvée dans le fichier Excel.");
  }

  // --- Parse Feuille LISTE ---
  const listSheet = workbook.getWorksheet('LISTE');
  if (listSheet) {
    // Start from row 2 to skip header
    for (let i = 2; i <= listSheet.rowCount; i++) {
      const row = listSheet.getRow(i);
      const nom = getCellValueAsString(row.getCell('A')).trim();
       if (nom) {
           const list: CommercialList = { nom };
           lists.push(list);
       }
    }
  } else {
    console.warn("Feuille 'LISTE' non trouvée dans le fichier Excel.");
  }

  // --- Parse Feuille NOM MENU CHAINE 1 ---
  const menuSheet = workbook.getWorksheet('NOM MENU CHAINE 1');
  if (menuSheet) {
    // Start from row 2 to skip header
    for (let i = 2; i <= menuSheet.rowCount; i++) {
      const row = menuSheet.getRow(i);
       // Check if the row seems valid (e.g., has a value in the PLAT column)
       if (getCellValueAsString(row.getCell('B')).trim()) {
           const menu: CommercialMenu = {
             entree: getCellValueAsString(row.getCell('A')),
             plat: getCellValueAsString(row.getCell('B')),
             dessert: getCellValueAsString(row.getCell('C')),
             prix: getCellValueAsNumber(row.getCell('D')),
           };
           menus.push(menu);
       }
    }
  } else {
    console.warn("Feuille 'NOM MENU CHAINE 1' non trouvée dans le fichier Excel.");
  }

  if (articles.length === 0 && lists.length === 0 && menus.length === 0) {
      throw new Error("Le fichier Excel ne contient aucune donnée valide dans les feuilles attendues (ARTICLE, LISTE, NOM MENU CHAINE 1) ou les feuilles sont manquantes.");
  }

  return { articles, lists, menus };
}

/**
 * Parses transcribed text from a menu image into CommercialData format.
 * This is a placeholder function and needs to be implemented based on the AI transcription output format.
 * @param transcribedText The text transcribed from the menu image by an AI service.
 * @returns A Promise resolving to CommercialData.
 */
export async function parseImageText(transcribedText: string): Promise<CommercialData> {
  console.log("Parsing transcribed text:", transcribedText);

  try {
    // Clean the transcribed text to remove markdown code block markers
    const cleanedText = transcribedText.replace(/^```json\n/, '').replace(/\n```$/, '');

    // Attempt to parse the cleaned text as JSON
    const parsedData = JSON.parse(cleanedText);

    // Validate the structure against CommercialData types
    // Validate the structure and apply mapping rules
    const articles: CommercialArticle[] = Array.isArray(parsedData.articles) ? parsedData.articles.map((item: any) => {
      // Validate required fields
      if (!item.groupe || typeof item.groupe !== 'string' || item.groupe.trim() === '') {
        throw new Error(`Article manquant ou groupe invalide: ${JSON.stringify(item)}`);
      }
       if (!item.tva || typeof item.tva !== 'string' || item.tva.trim() === '') {
         throw new Error(`Article manquant ou TVA invalide: ${JSON.stringify(item)}`);
       }

      return {
        groupe: item.groupe.trim(), // Trim whitespace and validate
        famille: item.famille || '', // Famille is now optional
        article: item.article || '',
        prix1: Number(item.prix1) || 0,
        prix2: Number(item.prix2) || 0,
        tva: item.tva.trim(), // Trim whitespace
        impression: '', // Always set impression to empty string
        liste: item.liste === 'oui' ? 'oui' : 'non',
      };
    }) : [];

    const lists: CommercialList[] = Array.isArray(parsedData.lists) ? parsedData.lists.map((item: any) => ({
      nom: item.nom || '',
    })) : [];

    const menus: CommercialMenu[] = Array.isArray(parsedData.menus) ? parsedData.menus.map((item: any) => ({
      entree: item.entree || '',
      plat: item.plat || '',
      dessert: item.dessert || '',
      prix: Number(item.prix) || 0,
    })) : [];

    // Basic check if any data was parsed
    if (articles.length === 0 && lists.length === 0 && menus.length === 0) {
        console.warn("Parsed JSON did not contain valid data for articles, lists, or menus.");
        // Depending on requirements, you might throw an error here or return empty data
    }


    return {
      articles,
      lists,
      menus,
    };

  } catch (error: any) {
    console.error("Error parsing transcribed text as JSON:", error);
    // If JSON parsing fails, attempt a simpler text analysis or return empty data
    // For now, we'll throw an error as the prompt expects JSON output
    throw new Error(`Failed to parse transcribed text as expected JSON format: ${error.message}`);
  }
}
