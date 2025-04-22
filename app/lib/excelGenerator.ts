import * as ExcelJS from 'exceljs';

declare global {
  interface Buffer extends Uint8Array {}
}

export interface CommercialArticle {
  groupe: string;
  famille: string;
  article: string;
  prix1: number;
  prix2?: number;
  tva?: string;
  impression?: string;
  liste: 'oui' | 'non';
}

export interface CommercialList {
  nom: string;
}

export interface CommercialMenu {
  entree: string;
  plat: string;
  dessert: string;
  prix: number;
}

export interface CommercialData {
  articles: CommercialArticle[];
  lists: CommercialList[];
  menus: CommercialMenu[];
}

export async function generateCommercialExcel(data: CommercialData): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();

  // Feuille ARTICLE
  const articleSheet = workbook.addWorksheet('ARTICLE');
  articleSheet.columns = [
    { header: 'GROUPE', key: 'groupe', width: 20 },
    { header: 'FAMILLE', key: 'famille', width: 20 },
    { header: 'ARTICLE', key: 'article', width: 30 },
    { header: 'PRIX 1', key: 'prix1', width: 15, style: { numFmt: '0.00€' } },
    { header: 'PRIX 2', key: 'prix2', width: 15, style: { numFmt: '0.00€' } },
    { header: 'TVA', key: 'tva', width: 10 },
    { header: 'IMPRESSION', key: 'impression', width: 10 },
    { header: 'LISTE', key: 'liste', width: 10 }
  ];

  data.articles.forEach(article => {
    articleSheet.addRow({
      groupe: article.groupe,
      famille: article.famille,
      article: article.article,
      prix1: article.prix1,
      prix2: article.prix2,
      tva: article.tva,
      impression: article.impression,
      liste: article.liste
    });
  });

  // Style en-tête ARTICLE
  articleSheet.getRow(1).eachCell(cell => {
    cell.font = { bold: true };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9EAD3' }
    };
  });

  // Feuille LISTE
  const listSheet = workbook.addWorksheet('LISTE');
  listSheet.columns = [
    { header: 'NOM', key: 'nom', width: 30 }
  ];

  data.lists.forEach(list => {
    listSheet.addRow(list);
  });

  // Style en-tête LISTE
  listSheet.getRow(1).eachCell(cell => {
    cell.font = { bold: true };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE6B8AF' }
    };
  });

  // Feuille NOM MENU CHAINE 1
  const menuSheet = workbook.addWorksheet('NOM MENU CHAINE 1');
  menuSheet.columns = [
    { header: 'ENTREE', key: 'entree', width: 30 },
    { header: 'PLAT', key: 'plat', width: 30 },
    { header: 'DESSERT', key: 'dessert', width: 30 },
    { header: 'PRIX', key: 'prix', width: 15, style: { numFmt: '0.00€' } }
  ];

  data.menus.forEach(menu => {
    menuSheet.addRow(menu);
  });

  // Style en-tête MENU
  menuSheet.getRow(1).eachCell(cell => {
    cell.font = { bold: true };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFC9DAF8' }
    };
  });

  return workbook.xlsx.writeBuffer();
}
