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
        // Use hardcoded credentials for internal app
        credentialSource = "HARDCODED";
        console.log("[FirebaseAdminConfig] Using hardcoded credentials...");
        // Use complete service account from provided JSON
        serviceAccount = {
          projectId: "sap-jdc",
          privateKey: `
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDk2DRRR1WNcCNr
BTkyGJqgjH+lzIZ6z5eYTv6Cna4ZS2JJ3qGDhKIowhnLroM7jzIqKC5R+ewmXfwo
+9iomnGf66OT9orjuXrOB/UpWTVXFC8E3rDvA24zXF3OKxete1dNtoo9NQA/8Rb0
Rp/MoAPv9tAz9GqATdHP2qJy61g+DMe4XmOHJPiDPlxqvYztwzmagpkvUYRKb2up
RlOe4nrP1rse8aVvTb+JAAtbuVO3A8aV4EWJf4MoNjlgXw5AtiiGNRMCeu/tWDy3
bVAsjGL8Nwct5I21AA39Wsdgo0vt+DlkB6B9cmetm8v48Z/OelQVN8QEY2OgLsRX
QjIKkcNJAgMBAAECggEABqALw7P2UhtGVeQs0mUhSjdHFXG6YvZ87mKQaQ+k6Vk5
WzzKyEKgFItUsS+NimfhjT7kjb2tNzR5XGZje14dSVf1Fbo0LdZCK+d8aC9g+p28
Tr5zuOJh37LI3x3NmFl9yY4t/7T3xjd18VR/boPOGWBiiV6GHCN584k3iBmFeyZY
OG0aHdZO6IWk9aQjz344BZM14yJBnaUC21kCepZItpjrVUERi6puvzaD228CgGW3
wQXhVv7duGAtydQu0ZFmMzBNy2ux9tReQte/2Eo88ua/5KvBz+k0rRGvuhQX+Smr
Dy1Ld6wS8/weNd4N8y3CjpDjCwcHCFAzafNH6uiHUQKBgQD1cTvOLx7dNIhfJLx0
BDoIYSHSVBHIa4IosFm/O8IERREt1CPI0zGAyf5XtZdmuHUEjmkcdxjW1qyt0BjJ
8InohyunF2VfwyLq8+zTs3OXCuzMj0tMUhSN1ZJn6DRQT0brsVb9zWIyWSeDcXON
dLjUPpiyjbcXO16+bZwNVWI7OwKBgQDusDL4nN5tgBv5O2vxYifuVBtoRY0rmmO/
xpHXuY56M3qh3hbiRIBN/uGf9OcESBuZuKDCOtnkuuIf5DPUW6g7x3gbuCall6Ix
TtWTrM6wn6fCtA3bP0CDzmmjJSnNwV89CHSNJiQAympFviWVsToouNUucHT4d/xQ
0kILxA6rSwKBgQCItgGx3t06KUCsfjHaDWClujS0is8862UcdN4Ifqia6D2hYUBt
Y/V23wwknqkuNiA34Xr6t/vF7t1QE1E7ahfmxSOzdnyo0nBonmWTpakEwLkVV9uB
L1bzibp61gQNl5rRPX5O8E95697ugAr1B8bLsfIrwnPxJMipGTSK2LxWcQKBgGD5
ERxUj0GppLPTYn2FRXfcj+4DI+GtLg2CHUqpxqr7Mz2EP4PaFM6bWQtlsl3Y9e20
RwviYRg+nRQb4LrMKkNvPOr2HC12t5yUzMzcjnTPyJagFGkY/5sNR3nS5XMEty7S
upeGAWaY1ihTom14vYpB3cqqQbuY89faNJ8XHmaVAoGAWcQlBIJUap1S+I5OVD2I
xilxcxjptuj7E9B3BL4Fc/IfrCGVfcTJlqbLJRPw2UmeY3lp+umz0fjO9BX3NGXD
MBcJGdBErDsluxSmGvJOojFiMnSQJdRapAWIimUfmDZtzzgdFppkC6uzT0Dd+/6Q
NDAjd3cfjZIEAmSyeVMAYbA=
-----END PRIVATE KEY-----
`.trim().replace(/\\n/g, '\n'),
          clientEmail: "remix-server-firestore@sap-jdc.iam.gserviceaccount.com"
        };
        console.log("[FirebaseAdminConfig] Using hardcoded credentials.");

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
