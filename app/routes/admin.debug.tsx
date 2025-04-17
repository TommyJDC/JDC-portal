import { json } from '@remix-run/node';
import { dbAdmin } from '~/firebase.admin.config.server';

export async function loader() {
  try {
    console.log("[AdminDebug] Starting Firestore users collection check...");
    const usersCol = dbAdmin.collection('users');
    const snapshot = await usersCol.get();
    console.log(`[AdminDebug] Found ${snapshot.size} users in collection`);
    
    return json({
      userCount: snapshot.size,
      firstUser: snapshot.docs[0]?.data() || null,
      firestoreStatus: 'CONNECTED'
    });
  } catch (error) {
    console.error("[AdminDebug] Firestore connection error:", error);
    return json({
      error: error instanceof Error ? error.message : 'Unknown error',
      firestoreStatus: 'ERROR'
    }, { status: 500 });
  }
}
