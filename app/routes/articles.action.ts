import type { ActionFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { addArticleImageUrl, deleteArticleImageUrl, uploadImageToCloudinary } from '~/services/firestore.service.server';
import { requireAdminUser } from '~/services/auth-utils.server'; // Assuming admin rights needed to modify articles

export async function action({ request }: ActionFunctionArgs) {
  // Ensure user is authenticated and authorized if necessary
  // await requireAdminUser(request); // Uncomment if only admins can modify

  const formData = await request.formData();
  const intent = formData.get('intent') as string;
  const articleId = formData.get('articleId') as string;
  const imageUrl = formData.get('imageUrl') as string;

  if (!intent) {
    return json({ success: false, error: 'Missing intent.' }, { status: 400 });
  }

  if ((intent === 'add_image' || intent === 'delete_image') && (!articleId || !imageUrl)) {
    return json({ success: false, error: 'Article ID and Image URL are required.' }, { status: 400 });
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
      await addArticleImageUrl(articleId, imageUrlToAdd);
      return json({ success: true, message: 'Image added successfully.', imageUrl: imageUrlToAdd });
    } else if (intent === 'delete_image') {
      await deleteArticleImageUrl(articleId, imageUrl);
      return json({ success: true, message: 'Image deleted successfully.' });
    } else {
      return json({ success: false, error: 'Invalid intent.' }, { status: 400 });
    }
  } catch (error: any) {
    console.error(`[Articles Action] Error processing intent ${intent}:`, error);
    return json({
      success: false,
      error: error.message || 'Failed to process image operation.'
    }, { status: 500 });
  }
}
