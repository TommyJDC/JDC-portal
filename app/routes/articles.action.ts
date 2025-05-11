import type { ActionFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { addArticleImageUrl, deleteArticleImageUrl, uploadImageToCloudinary } from '~/services/firestore.service.server';
import { requireAdminUser } from '~/services/auth-utils.server'; // Assuming admin rights needed to modify articles

/**
 * Action pour gérer les images des articles
 * Même si l'article est stocké sur la blockchain, les images restent sur Firestore car
 * la blockchain n'est pas adaptée au stockage d'images
 */
export async function action({ request }: ActionFunctionArgs) {
  // Ensure user is authenticated and authorized if necessary
  // await requireAdminUser(request); // Uncomment if only admins can modify

  const formData = await request.formData();
  const intent = formData.get('intent') as string;
  // Renommer articleId par articleCode pour plus de clarté
  const articleCode = formData.get('articleId') as string;
  const imageUrl = formData.get('imageUrl') as string;

  if (!intent) {
    return json({ success: false, error: 'Intent manquant.' }, { status: 400 });
  }

  if ((intent === 'add_image' || intent === 'delete_image') && (!articleCode || !imageUrl)) {
    return json({ success: false, error: 'Code article et URL de l\'image requis.' }, { status: 400 });
  }

  try {
    if (intent === 'add_image') {
      // Si un fichier est envoyé, upload côté serveur
      const file = formData.get('file');
      let imageUrlToAdd = imageUrl;
      if (file && typeof file === 'object' && 'arrayBuffer' in file) {
        const buffer = Buffer.from(await file.arrayBuffer());
        imageUrlToAdd = await uploadImageToCloudinary(buffer, file.name);
      }
      // On utilise toujours Firestore pour stocker les URLs des images
      // car c'est plus adapté que la blockchain pour ce type de données
      await addArticleImageUrl(articleCode, imageUrlToAdd);
      return json({ success: true, message: 'Image ajoutée avec succès.', imageUrl: imageUrlToAdd });
    } else if (intent === 'delete_image') {
      await deleteArticleImageUrl(articleCode, imageUrl);
      return json({ success: true, message: 'Image supprimée avec succès.' });
    } else {
      return json({ success: false, error: 'Intent invalide.' }, { status: 400 });
    }
  } catch (error: any) {
    console.error(`[Articles Action] Erreur lors du traitement de l'intent ${intent}:`, error);
    return json({
      success: false,
      error: error.message || 'Échec de l\'opération sur l\'image.'
    }, { status: 500 });
  }
}
