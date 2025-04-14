import type { LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { getAllUserProfilesSdk } from '~/services/firestore.service.server';
import { requireAdminUser } from '~/services/auth-utils.server';

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdminUser(request);
  const users = await getAllUserProfilesSdk();
  return json({ users });
}
