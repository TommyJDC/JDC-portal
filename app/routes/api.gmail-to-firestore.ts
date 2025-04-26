import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticator } from "~/services/auth.server";
import { getGoogleAuthClient } from "~/services/google.server";
import { processGmailToFirestore } from "~/services/gmail.service.server";
import { getUserProfileSdk, getAllUserProfilesSdk } from "~/services/firestore.service.server";
import type { GmailProcessingConfig, UserProfile } from "~/types/firestore.types";
import type { UserSession } from "~/services/session.server";
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { google , gmail_v1 } from 'googleapis';


let db: FirebaseFirestore.Firestore;

async function initializeFirebaseAdmin() {
  try {
    const app = initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      })
    });
    
    db = getFirestore(app);
    return db;
  } catch (error: any) {
    if (error.code === 'app/duplicate-app') {
      const apps = getApps();
      const app = apps.length ? apps[0] : null;
      if (app) {
        db = getFirestore(app);
        return db;
      }
    }
    console.error('Firebase Admin initialization error:', error);
    throw error;
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    if (!db) {
      db = await initializeFirebaseAdmin();
    }
    
    // Suppression de toute vérification d'authentification ou de SCHEDULED_TASK_SECRET
    // L'API est accessible sans authentification

    // Récupérer la configuration Gmail
    const configDoc = await db.collection('settings').doc('gmailProcessingConfig').get();
    const config: GmailProcessingConfig = configDoc.exists ? configDoc.data() as GmailProcessingConfig : {
      maxEmailsPerRun: 50,
      processedLabelName: "Traité",
      refreshInterval: 5,
      sectorCollections: {
        chr: { enabled: true, labels: ["CHR"], responsables: [] },
        haccp: { enabled: true, labels: ["HACCP"], responsables: [] },
        tabac: { enabled: true, labels: ["TABAC"], responsables: [] },
        kezia: { enabled: true, labels: ["KEZIA"], responsables: [] }
      }
    };

    // Récupérer tous les utilisateurs
    const users = await getAllUserProfilesSdk();
    const usersByUid = Object.fromEntries(users.map(u => [u.uid, u]));

    // Pour chaque secteur activé, traiter les mails avec chaque responsable
    const sectorKeys = Object.keys(config.sectorCollections) as Array<keyof typeof config.sectorCollections>;
    const results: any[] = [];
    for (const sector of sectorKeys) {
      const sectorConfig = config.sectorCollections[sector];
      if (!sectorConfig.enabled || !sectorConfig.responsables || sectorConfig.responsables.length === 0) continue;
      for (const uid of sectorConfig.responsables) {
        const user = usersByUid[uid];
        if (!user || !user.googleRefreshToken || user.gmailAuthStatus !== 'active') {
          results.push({
            sector,
            email: user ? user.email : uid,
            success: false,
            error: 'Utilisateur non trouvé ou refreshToken/Gmail non valide'
          });
          continue;
        }
        try {
          const session: UserSession = {
            userId: user.uid,
            email: user.email,
            displayName: user.displayName,
            googleRefreshToken: user.googleRefreshToken
          };
          const authClient = await getGoogleAuthClient(session);
          if (!authClient) throw new Error(`Impossible d'obtenir le client Google pour ${user.email}`);
          // On passe la config avec tous les secteurs, mais seul le secteur courant est activé
          const sectorCollections = Object.fromEntries(
            Object.entries(config.sectorCollections).map(([key, value]) => [
              key,
              key === sector ? value : { ...value, enabled: false }
            ])
          ) as GmailProcessingConfig["sectorCollections"];
          await processGmailToFirestore(authClient, {
            ...config,
            sectorCollections
          });
          results.push({ sector, email: user.email, success: true });
        } catch (error) {
          console.error(`Erreur pour ${user.email} (${sector}):`, error);
          results.push({
            sector,
            email: user.email,
            success: false,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;
    return json({
      success: true,
      message: `Traitement terminé. Succès: ${successCount}, Échecs: ${failureCount}`,
      details: results
    });
  } catch (error) {
    console.error("[API Gmail-to-Firestore] Erreur:", error);
    return json(
      { 
        success: false, 
        error: `Erreur lors du traitement: ${error instanceof Error ? error.message : String(error)}` 
      }, 
      { status: 500 }
    );
  }
}
