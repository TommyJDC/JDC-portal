import { authenticator } from './auth.server';
import { getUserProfileSdk } from './firestore.service.server';
import type { UserSession } from './session.server';

export async function requireAdminUser(request: Request) {
  const user = await authenticator.isAuthenticated(request);
  if (!user) {
    throw new Response("Unauthorized", { status: 401 });
  }
  
  const profile = await getUserProfileSdk(user.userId);
  if (profile?.role?.toLowerCase() !== 'admin') {
    throw new Response("Forbidden", { status: 403 });
  }
  
  return user;
}
