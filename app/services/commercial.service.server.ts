import { Buffer } from 'node:buffer';
import { parseMenuFile, parseImageText } from "../lib/menuParser";
import { generateCommercialExcel, type CommercialData } from "../lib/excelGenerator";
import type { UploadHandler } from "@remix-run/node";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getStorageInstance } from '../firebase.admin.config.server';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_EXCEL_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel'
];

async function uploadFileToFirestore(buffer: Buffer, filename: string): Promise<string> {
  const storage = getStorageInstance();
  const bucket = process.env.FIREBASE_STORAGE_BUCKET;
  if (!bucket) throw new Error('FIREBASE_STORAGE_BUCKET not configured');
  
  const fileRef = storage.bucket(bucket).file(`commercial/${filename}`);
  await fileRef.save(buffer, {
    metadata: { 
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    },
  });
  return fileRef.getSignedUrl({ action: 'read', expires: '03-09-2491' })
    .then(([url]) => url);
}

async function fileToBase64(file: File): Promise<string> {
  return Buffer.from(await file.arrayBuffer()).toString('base64');
}

async function transcribeImageWithGemini(imageFile: File): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API key is not configured.");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-001" });

  const prompt = `Transcrivez le texte de ce menu de restaurant et structurez les données au format JSON suivant. Appliquez strictement les règles de TVA française :

Règles de TVA 2025 (à appliquer dans l'ordre de priorité) :

1. 2,1% - Spécial :
   - Médicaments remboursables
   - Publications de presse
   - Évènements culturels

2. 5,5% - Réduit :
   - Eaux minérales et boissons sans alcool
   - Produits alimentaires de base non transformés
   - Énergies renouvelables
   - Livres numériques

3. 10% - Intermédiaire :
   - Restauration sur place
   - Transports de voyageurs
   - Hôtellerie (hors luxe)
   - Travaux de rénovation résidentielle

4. 20% - Standard :
   - Alcool fort (>1.2°)
   - Produits manufacturés
   - Électronique grand public
   - Services numériques

Matrice de décision TVA :

| Mot-clé                | Exemples                 | TVA  |
|------------------------|--------------------------|------|
| eau, jus, lait         | Bouteille d'eau 1L       | 5,5% |
| vin, bière, cocktail   | Pichet de rosé 50cl      | 10%  |
| whisky, vodka, rhum     | Shot de whisky           | 20%  |
| menu, formule, plateau | Menu du jour             | 10%  |
| pain, fromage, fruit    | Assiette de fromages     | 5,5% |
| livraison, emporter    | Pizza à emporter         | 10%  |
| enfant, senior         | Menu junior              | 10%  |
| luxe, premium          | Plateau fruits de mer    | 20%  |

Exemples complexes :
- "Café gourmand" → 10% (dessert + boisson chaude)
- "Plateau de charcuterie" → 5,5% (produit alimentaire de base)
- "Cocktail sans alcool" → 10% (service de bar)
- "Bouteille de champagne" → 20% (alcool >1.2°)

Analysez chaque article pour :
1. Détecter les indicateurs de catégorie dans le nom/article
2. Croiser avec le contexte global du menu
3. Appliquer le taux approprié selon la loi française

Règles strictes :
1. INTERDICTION d'utiliser 20% comme valeur par défaut
2. OBLIGATION de justifier le taux choisi par au moins un indicateur du tableau
3. Croiser les informations entre :
   - Catégorie de l'article
   - Désignation produit
   - Contexte global du menu
4. Vérifier la cohérence prix/taux (ex: un sandwich à 5€ ne peut avoir 20%)

En cas de doute :
- Utiliser "N/A"
- Ajouter "ALERTE: Impossible de déterminer la TVA" dans 'commentaires'
- Lister les indicateurs trouvés
{
  "articles": [
    {
      "groupe": "string", // Catégorie générale (ex: Entrées, Plats, Desserts) - OBLIGATOIRE
      "famille": "string", // Sous-catégorie (ex: Poissons, Viandes)
      "article": "string", // Nom de l'article du menu
      "prix1": number, // Prix principal
      "prix2": number, // Deuxième prix si applicable (ex: petite/grande portion)
      "tva": "string", // Taux de TVA ("2,1%", "5,5%", "10%", "20%") ou "N/A" si indéterminable
      "commentaires": "string", // Alerte si TVA non déterminée
      "impression": "string", // Lieu d'impression (ex: "Cuisine", "Bar") - Doit être une chaîne vide.
      "liste": "oui" | "non" // Indique si l'article est une liste (ex: liste de vins)
    }
  ],
  "lists": [
    {
      "nom": "string" // Nom de la liste (ex: "Vins Rouges", "Boissons")
    }
  ],
  "menus": [
    {
      "entree": "string", // Nom de l'entrée du menu
      "plat": "string", // Nom du plat principal du menu
      "dessert": "string", // Nom du dessert du menu
      "prix": number // Prix du menu complet
    }
  ]
}
`;

  const imageBase64 = await fileToBase64(imageFile);

  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        data: imageBase64,
        mimeType: imageFile.type,
      },
    },
  ]);

  const response = result.response;
  const transcribedText = response.text();

  if (!transcribedText) {
    throw new Error("Failed to transcribe image with Gemini.");
  }

  return transcribedText;
}

export const uploadHandler: UploadHandler = async ({ name, data, filename, contentType }) => {
  if (name === "commercialFile") {
    const chunks = [];
    for await (const chunk of data) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    return new File([buffer], filename || "commercial", { type: contentType });
  }

  // For any other fields, return undefined to ignore them
  return undefined;
};

export async function handleFileUpload(file: File): Promise<CommercialUploadResult> {
  if (!file?.name) throw new Error("Invalid file");

  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  const isImage = !file.type 
    ? ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)
    : ALLOWED_IMAGE_TYPES.includes(file.type);
  
  const isExcel = !file.type
    ? ['xlsx', 'xls'].includes(extension)
    : ALLOWED_EXCEL_TYPES.includes(file.type);

  if (isImage) {
    const text = await transcribeImageWithGemini(file);
    const data = await parseImageText(text);
    return { commercialData: data, originalFileName: file.name };
  }

  if (isExcel) {
    const data = await parseMenuFile(file);
    return { commercialData: data, originalFileName: file.name }; // Return data for preview
  }

  throw new Error(`Type de fichier non supporté: ${file.type || extension}`);
}

export async function generateAndUploadExcel(commercialData: CommercialData, originalFileName: string): Promise<CommercialUploadResult> {
   // Génère le fichier Excel avec les 3 feuilles
   const excelBuffer = await generateCommercialExcel(commercialData);

   // Sauvegarde le fichier Excel dans Firestore Storage
   const excelUrl = await uploadFileToFirestore(
     Buffer.from(excelBuffer),
     `${Date.now()}_${originalFileName.replace(/\.[^/.]+$/, "")}.xlsx`
   );

   return { excelUrl };
}

export type CommercialUploadResult = {
  excelUrl?: string;
  commercialData?: CommercialData;
  originalFileName?: string;
  error?: string;
};
