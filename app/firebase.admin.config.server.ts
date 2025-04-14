import * as admin from 'firebase-admin';
    import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
    // Import App type explicitly
    import { initializeApp as initializeAdminApp, getApps as getAdminApps, type ServiceAccount, cert, type App as AdminApp } from 'firebase-admin/app';
    // Removed fs and path imports
    // Removed applicationDefault import

    let dbAdmin: admin.firestore.Firestore;
    let adminApp: AdminApp; // Use the imported AdminApp type

    // --- Firebase Admin Initialization ---
    if (getAdminApps().length === 0) {
      console.log("[FirebaseAdminConfig] No existing apps found. Initializing Firebase Admin SDK...");
      // Initialize serviceAccount with a default structure or handle undefined later
      let serviceAccount: ServiceAccount | string | undefined = undefined; // Allow string for file path
      let credentialSource: string = "unknown"; // For logging

      try {
        // Option 1: Use BASE64 credentials if on Netlify
        if (process.env.NETLIFY && process.env.GOOGLE_CREDENTIALS_BASE64) {
          credentialSource = "BASE64";
          console.log("[FirebaseAdminConfig] Attempting initialization via BASE64 credentials...");
          const decodedCreds = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, "base64").toString("utf-8");
          // Parse directly into ServiceAccount type
          serviceAccount = JSON.parse(decodedCreds) as ServiceAccount;
          console.log("[FirebaseAdminConfig] Parsed BASE64 credentials.");
        }
        // Option 2: Use local file path if GOOGLE_APPLICATION_CREDENTIALS is set (for local dev)
        else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
           credentialSource = "FILE_PATH";
           console.log(`[FirebaseAdminConfig] Attempting initialization via GOOGLE_APPLICATION_CREDENTIALS path: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);
           // The 'cert' function can take the file path directly
           serviceAccount = process.env.GOOGLE_APPLICATION_CREDENTIALS; // Assign the path string
           console.log("[FirebaseAdminConfig] Using credentials file path.");
        }
        // Option 3: Use individual environment variables (less common now but possible)
        else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
             credentialSource = "ENV_VARS";
             console.log("[FirebaseAdminConfig] Attempting initialization via individual ENV VARS...");
             serviceAccount = {
                 projectId: process.env.FIREBASE_PROJECT_ID,
                 // Ensure private key newlines are handled correctly
                 privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
                 clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
             };
             console.log("[FirebaseAdminConfig] Using individual ENV VARS credentials.");
        } else {
             console.error("[FirebaseAdminConfig] CRITICAL: No valid Firebase Admin credentials found (checked BASE64, file path, individual vars).");
             throw new Error("Firebase Admin credentials not configured.");
        }

        // Ensure serviceAccount is defined before calling cert
        if (!serviceAccount) {
             throw new Error("Could not determine valid Firebase Admin credentials.");
        }

        // Initialize app with the determined credentials
        adminApp = initializeAdminApp({
          // Use cert() for object credentials or file path string
          credential: cert(serviceAccount), // serviceAccount is now guaranteed to be defined and of correct type (string | ServiceAccount)
          // Optionally add databaseURL if needed, though usually inferred
          // databaseURL: `https://${(typeof serviceAccount === 'object' ? serviceAccount.projectId : process.env.FIREBASE_PROJECT_ID)}.firebaseio.com`
        });
        console.log(`[FirebaseAdminConfig] Firebase Admin SDK initialized successfully using source: ${credentialSource}.`);

      } catch (error: any) {
        console.error(`[FirebaseAdminConfig] CRITICAL: Failed to initialize Firebase Admin SDK using source ${credentialSource}:`, error);
        // Log specific parsing errors if they occur
        if (credentialSource === "BASE64" && error instanceof SyntaxError && error.message.includes("JSON")) {
             console.error("[FirebaseAdminConfig] Error likely due to invalid JSON in GOOGLE_CREDENTIALS_BASE64 after decoding.");
        }
        throw new Error(`Failed to initialize Firebase Admin SDK: ${error.message}`);
      }
    } else {
      console.log("[FirebaseAdminConfig] Firebase Admin SDK already initialized.");
      // Get the existing default app instance
      adminApp = getAdminApps()[0]; // This should be AdminApp type now
    }

    // Get Firestore instance from the initialized app
    try {
        // Ensure adminApp is correctly typed before passing to getAdminFirestore
        dbAdmin = getAdminFirestore(adminApp as admin.app.App); // Explicit cast if needed, though type inference should work
        console.log("[FirebaseAdminConfig] Firestore instance obtained successfully.");
    } catch (error) {
         console.error("[FirebaseAdminConfig] CRITICAL: Failed to get Firestore instance from Admin SDK:", error);
         // Provide a fallback or throw an error
         throw new Error("Failed to get Firestore instance from Admin SDK. Ensure initialization succeeded.");
    }

    export { dbAdmin };
