import { json } from '@remix-run/node';
import { getDb } from '~/firebase.admin.config.server'; // Import getDb instead of dbAdmin

export async function loader() {
  try {
    const db = getDb(); // Call getDb() to get the Firestore instance
    console.log("[AdminDebug] Starting Firestore users collection check...");
    const usersCol = db.collection('users'); // Use db instead of dbAdmin
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
