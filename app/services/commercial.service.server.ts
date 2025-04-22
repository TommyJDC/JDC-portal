import { Buffer } from 'node:buffer';
import { parseMenuFile } from "../lib/menuParser";
import { generateCommercialExcel, type CommercialData } from "../lib/excelGenerator";
import type { UploadHandler } from "@remix-run/node";
import { unstable_parseMultipartFormData } from "@remix-run/node";
import fetch from 'node-fetch';
import FormData from 'form-data';

const cloudinaryConfig = {
  cloudName: 'dkeqzl54y',
  apiKey: '725561566214411',
  apiSecret: process.env.CLOUDINARY_API_SECRET || 'cJQOY_KSc0gkmLFx2nT496VbBVY',
  uploadPreset: 'commercial_files'
};

async function uploadFileToCloudinary(buffer: Buffer, filename: string): Promise<string> {
  try {
    const formData = new FormData();
    formData.append('file', buffer, { filename });
    formData.append('upload_preset', cloudinaryConfig.uploadPreset);
    formData.append('cloud_name', cloudinaryConfig.cloudName);
    formData.append('api_key', cloudinaryConfig.apiKey);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/raw/upload`,
      {
        method: 'POST',
        body: formData
      }
    );

    if (!response.ok) {
      throw new Error(`Cloudinary upload failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.secure_url;
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    throw error;
  }
}

export async function uploadCommercialDataToExcel(file: File) {
  // Parse les données commerciales depuis le fichier Excel
  const commercialData = await parseMenuFile(file);

  // Génère le fichier Excel avec les 3 feuilles
  const excelBuffer = await generateCommercialExcel(commercialData);

  // Sauvegarde le fichier Excel dans Cloudinary
  const excelUrl = await uploadFileToCloudinary(
    Buffer.from(excelBuffer),
    `${Date.now()}_${file.name.replace(/\.[^/.]+$/, "")}.xlsx`
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
