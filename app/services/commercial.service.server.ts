import { Buffer } from 'node:buffer'; // Import de Buffer en haut
import { parseMenuFile } from "../lib/menuParser";
import { generateCommercialExcel, type CommercialData } from "../lib/excelGenerator"; // Correction du chemin
import { saveFileToStorage } from "./firestore.service.server";
import type { UploadHandler } from "@remix-run/node";
import { unstable_parseMultipartFormData } from "@remix-run/node";

export async function uploadCommercialDataToExcel(file: File) {
  // Parse les données commerciales depuis le fichier Excel
  const commercialData = await parseMenuFile(file);

  // Génère le fichier Excel avec les 3 feuilles
  const excelBuffer = await generateCommercialExcel(commercialData);

  // Sauvegarde le fichier Excel dans Firebase Storage
  const excelUrl = await saveFileToStorage(
    Buffer.from(excelBuffer), // Convertir explicitement en Buffer
    `commercial/${Date.now()}_${file.name.replace(/\.[^/.]+$/, "")}.xlsx`,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );

  return { excelUrl };
}

export const uploadHandler: UploadHandler = async ({
  name,
  data,
  filename,
  contentType,
}) => {
  if (name !== "commercialFile") {
    return undefined;
  }

  const chunks = [];
  for await (const chunk of data) {
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);

  return new File([buffer], filename || "commercial", { type: contentType });
};

export type ExcelUploadResult = {
  excelUrl: string;
};

export async function handleFileUpload(request: Request): Promise<ExcelUploadResult> {
  const formData = await unstable_parseMultipartFormData(
    request,
    uploadHandler
  );

  const file = formData.get("commercialFile");
  if (!file || !(file instanceof File)) {
    throw new Error("Invalid file upload");
  }

  return uploadCommercialDataToExcel(file);
}
