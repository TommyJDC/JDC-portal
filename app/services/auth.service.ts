import {
      getAuth,
      signInWithEmailAndPassword,
      signOut as firebaseSignOut,
      onAuthStateChanged,
      createUserWithEmailAndPassword,
      updateProfile as updateFirebaseProfile, // Renamed to avoid conflict
      GoogleAuthProvider, // Import Google provider
      signInWithPopup, // Import popup sign-in method
      type User as FirebaseUser,
      type AuthError
    } from "firebase/auth";
    import { auth } from "~/firebase.config"; // Use the initialized auth instance
    // Removed direct import of server SDK functions
    // import { createUserProfileSdk, getUserProfileSdk } from "./firestore.service.server";
    import type { UserProfile } from "~/types/firestore.types"; // Keep UserProfile type if needed elsewhere

    // Define a simpler User type for our app state
    export interface AppUser {
      uid: string;
      email: string | null;
      displayName: string | null; // Add other relevant fields if needed
    }

    // --- Map Firebase User to App User ---
    const mapFirebaseUserToAppUser = (firebaseUser: FirebaseUser): AppUser => {
        return {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
        };
    };

    // --- Login ---
    export const signIn = async (email: string, password: string): Promise<AppUser> => {
      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return mapFirebaseUserToAppUser(userCredential.user);
      } catch (error) {
        console.error("Firebase Sign In Error:", error);
        const authError = error as AuthError;
        if (authError.code === 'auth/invalid-credential' || authError.code === 'auth/user-not-found' || authError.code === 'auth/wrong-password') {
           throw new Error("Email ou mot de passe incorrect.");
        } else if (authError.code === 'auth/invalid-email') {
            throw new Error("Format d'email invalide.");
        }
        throw new Error("Erreur de connexion. Veuillez réessayer.");
      }
    };

    // --- Logout ---
    export const signOut = async (): Promise<void> => {
      try {
        await firebaseSignOut(auth);
      } catch (error) {
        console.error("Firebase Sign Out Error:", error);
        throw new Error("Erreur lors de la déconnexion.");
      }
    };

    // --- Sign Up (Client-side Auth only) ---
    // This function now ONLY creates the Firebase Auth user.
    // Profile creation MUST be handled server-side (e.g., in root loader after detecting a new user).
    export const signUp = async (email: string, password: string, displayName: string): Promise<AppUser> => {
      let firebaseUser: FirebaseUser | null = null;

      try {
        // Step 1: Create user in Firebase Authentication
        console.log(`[AuthService] Attempting to create Auth user for: ${email}`);
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        firebaseUser = userCredential.user;
        console.log(`[AuthService] Auth user created successfully: ${firebaseUser.uid}`);

        // Step 1.5: Update Firebase Auth profile display name (optional but good practice)
        try {
            await updateFirebaseProfile(firebaseUser, { displayName: displayName });
            console.log(`[AuthService] Firebase Auth profile display name updated for: ${firebaseUser.uid}`);
        } catch (updateError) {
            console.warn(`[AuthService] Could not update Firebase Auth display name for ${firebaseUser.uid}:`, updateError);
            // Non-critical, continue
        }

        // Step 2: Profile creation is REMOVED from client-side.
        // It must be handled by a server-side loader (e.g., root loader)
        // checking if a profile exists for the authenticated user.

        return mapFirebaseUserToAppUser(firebaseUser); // Return only the AppUser

      } catch (error) {
        console.error("[AuthService] Error during sign up:", error); // Updated error context
        const authError = error as AuthError;

        // Keep existing Auth error handling
        if (authError.code === 'auth/email-already-in-use') {
          throw new Error("Cette adresse email est déjà utilisée.");
        } else if (authError.code === 'auth/invalid-email') {
          throw new Error("Format d'email invalide.");
        } else if (authError.code === 'auth/weak-password') {
          throw new Error("Le mot de passe est trop faible (minimum 6 caractères).");
        }
        // Removed Firestore-specific error handling from here
        throw new Error("Erreur lors de la création du compte Auth. Veuillez réessayer.");
      }
    };

    // --- Sign In with Google (Client-side Auth only) ---
    // Profile check/creation MUST be handled server-side (e.g., in root loader or callback route loader).
    export const signInWithGoogle = async (): Promise<AppUser> => {
      const provider = new GoogleAuthProvider();
      try {
        console.log("[AuthService] Attempting Google Sign-In Popup...");
        const result = await signInWithPopup(auth, provider);
        const firebaseUser = result.user;
        console.log(`[AuthService] Google Sign-In successful for: ${firebaseUser.uid} (${firebaseUser.email})`);

        // REMOVED Firestore profile check/creation from client-side.
        // This needs to happen in a loader (e.g., root or callback) after auth.

        return mapFirebaseUserToAppUser(firebaseUser);

      } catch (error) {
        console.error("[AuthService] Google Sign In Error:", error);
        const authError = error as AuthError;
        if (authError.code === 'auth/popup-closed-by-user') {
          throw new Error("Connexion Google annulée.");
        } else if (authError.code === 'auth/account-exists-with-different-credential') {
          throw new Error("Un compte existe déjà avec cet email mais avec une méthode de connexion différente.");
          // TODO: Consider implementing account linking flow here if needed
        } else if (authError.code === 'auth/cancelled-popup-request') {
            throw new Error("Multiples tentatives de connexion Google détectées. Veuillez réessayer.");
        }
        // Add other specific Google error codes if needed
        throw new Error("Erreur lors de la connexion avec Google. Veuillez réessayer.");
      }
    };


    // --- Auth State Listener ---
    export const listenToAuthState = (callback: (user: AppUser | null) => void): (() => void) => {
      const unsubscribe = onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
        if (firebaseUser) {
          // User is signed in, map to AppUser
          const appUser = mapFirebaseUserToAppUser(firebaseUser);
          callback(appUser);
        } else {
          // User is signed out
          callback(null);
        }
      });

      return unsubscribe; // Return the unsubscribe function for cleanup
    };
