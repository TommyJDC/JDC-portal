import type { ActionFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { updateUserProfileSdk } from '~/services/firestore.service.server';
import { requireAdminUser } from '~/services/auth-utils.server';

export async function action({ request }: ActionFunctionArgs) {
  await requireAdminUser(request);
  const formData = await request.formData();
  const userId = formData.get('userId') as string;
  const updates = JSON.parse(formData.get('updates') as string);
  
  try {
    await updateUserProfileSdk(userId, updates);
    return json({ success: true });
  } catch (error) {
    return json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
