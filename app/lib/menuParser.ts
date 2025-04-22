import { Buffer } from 'node:buffer';
import * as ExcelJS from 'exceljs';
import type { CommercialData, CommercialArticle, CommercialList, CommercialMenu } from './excelGenerator';

// Helper function to safely get cell value as string
function getCellValueAsString(cell: ExcelJS.Cell | undefined): string {
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
function getCellValueAsNumber(cell: ExcelJS.Cell | undefined): number {
  if (!cell || cell.value === null || cell.value === undefined) {
    return 0;
  }
  const num = Number(cell.value);
  return isNaN(num) ? 0 : num;
}

// Helper function to safely get cell value as 'oui' or 'non'
function getCellValueAsOuiNon(cell: ExcelJS.Cell | undefined): 'oui' | 'non' {
    const value = getCellValueAsString(cell).toLowerCase().trim();
    return value === 'oui' ? 'oui' : 'non';
}


export async function parseMenuFile(file: File): Promise<CommercialData> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = new ExcelJS.Workbook();
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
