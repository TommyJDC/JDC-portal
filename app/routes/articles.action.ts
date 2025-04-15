import type { ActionFunctionArgs } from '@remix-run/node';
    import { json } from '@remix-run/node';
    import { addArticleImageUrl, deleteArticleImageUrl } from '~/services/firestore.service.server';
    import { requireAdminUser } from '~/services/auth-utils.server'; // Assuming admin rights needed to modify articles

    export async function action({ request }: ActionFunctionArgs) {
      // Ensure user is authenticated and authorized if necessary
      // await requireAdminUser(request); // Uncomment if only admins can modify

      const formData = await request.formData();
      const intent = formData.get('intent') as string;
      const articleId = formData.get('articleId') as string;
      const imageUrl = formData.get('imageUrl') as string;

      if (!articleId || !imageUrl) {
        return json({ success: false, error: 'Article ID and Image URL are required.' }, { status: 400 });
      }

      try {
        if (intent === 'add_image') {
          await addArticleImageUrl(articleId, imageUrl);
          return json({ success: true, message: 'Image added successfully.' });
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
