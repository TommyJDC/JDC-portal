import { type ReactNode, useEffect, useState, Suspense } from 'react';
    import {
      Links,
      Meta,
      Outlet,
      Scripts,
      ScrollRestoration,
      useLoaderData,
      useLocation,
      useNavigation,
       // useSubmit, // Removed as it was only for client-side logout
     } from "@remix-run/react";
     // Consolidate imports from @remix-run/node
     import type { LinksFunction, LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
     import { json, redirect } from "@remix-run/node";
     import * as NProgress from 'nprogress'; // Use namespace import
     // Import CSS files using ?url suffix for Vite compatibility in links function
     import tailwindStylesHref from "~/tailwind.css?url";
     import globalStylesHref from "~/styles/global.css?url";
     import nProgressStylesHref from "nprogress/nprogress.css?url";
     import mapboxStylesHref from 'mapbox-gl/dist/mapbox-gl.css?url'; // Import Mapbox CSS with ?url
     // Import FontAwesome CSS for manual inclusion
     import fontAwesomeStylesHref from '@fortawesome/fontawesome-svg-core/styles.css?url';

import { Header } from "~/components/Header";
import { DebugAuth } from "~/components/DebugAuth";
    import { MobileMenu } from "~/components/MobileMenu";
    import { AuthModal } from "~/components/AuthModal";
    import ToastContainer from '~/components/Toast'; // Correct: Import default export
    import { ToastProvider, useToast } from '~/context/ToastContext'; // Import ToastProvider and useToast
    // Firebase client-side auth imports are removed
    import type { UserProfile } from '~/types/firestore.types'; // Keep UserProfile type
    // Re-introduce client SDK imports for profile fetching
import { getFirestore, doc, getDoc, Timestamp } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth'; // Import Auth functions
import { db as clientDb, app as clientApp } from '~/firebase.config'; // Import client db and app instance
import { authenticator } from "~/services/auth.server"; // Import remix-auth authenticator
import type { UserSession } from "~/services/session.server"; // Import UserSession type

     // Define links for CSS
     export const links: LinksFunction = () => [
       // Google Fonts - Roboto
       { rel: "preconnect", href: "https://fonts.googleapis.com" },
       { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
       { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" },
       // App Styles - Use imported hrefs
       { rel: "stylesheet", href: tailwindStylesHref },
       { rel: "stylesheet", href: globalStylesHref },
       { rel: "stylesheet", href: nProgressStylesHref },
       { rel: "stylesheet", href: mapboxStylesHref },
       // Add FontAwesome CSS link
       { rel: "stylesheet", href: fontAwesomeStylesHref },
     ];

     // --- Root Loader: Load ONLY the user session ---
     export const loader = async ({ request }: LoaderFunctionArgs) => {
       console.log("Root Loader: Checking authentication state via remix-auth.");
       // Attempt to get the user session from the request using the authenticator
       const userSession = await authenticator.isAuthenticated(request); // Returns UserSession or null

       // DO NOT fetch profile here to avoid serialization issues with Timestamps
       console.log("Root Loader: Returning data:", { user: userSession });
       return json({ user: userSession });
     };

    // --- Root Action ---
    // Consider removing if no root actions other than logout (handled by /logout) are needed.
    export const action = async ({ request }: ActionFunctionArgs) => {
      const formData = await request.formData();
      const action = formData.get("_action");
      console.warn("Root Action: Received unexpected action:", action);
      return json({ ok: false, error: "Invalid root action" }, { status: 400 });
    };

    // --- Client-side Profile Fetch Function ---
    // Uses the Firebase Client SDK
    async function getClientUserProfile(userId: string): Promise<UserProfile | null> {
        if (!userId) {
            console.warn(`[getClientUserProfile] Called with empty userId`);
            return null;
        }
        console.log(`[getClientUserProfile] Fetching profile client-side for ID: ${userId}`);
        
        try {
            // Essayer de récupérer le profil depuis Firestore
            const userDocRef = doc(clientDb, 'users', userId);
            console.log(`[getClientUserProfile] Document reference created for 'users/${userId}'`);
            
            const userDocSnap = await getDoc(userDocRef);
            console.log(`[getClientUserProfile] Document snapshot retrieved, exists: ${userDocSnap.exists()}`);

            // Si le document existe dans Firestore
            if (userDocSnap.exists()) {
                const data = userDocSnap.data();
                console.log(`[getClientUserProfile] Raw data from Firestore:`, data);
                
                // Convert Timestamps to Dates
                const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : undefined;
                const updatedAt = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : undefined;
                
                // Vérifier si le rôle est présent
                if (!data.role) {
                    console.warn(`[getClientUserProfile] Role is missing or empty for user ${userId}, defaulting to Utilisateur`);
                    data.role = 'Utilisateur'; // Définir le rôle par défaut à Utilisateur si manquant
                } else {
                    console.log(`[getClientUserProfile] User role: ${data.role} (${typeof data.role})`);
                }
                
                const profile = {
                    uid: userId,
                    email: data.email || '',
                    displayName: data.displayName || '',
                    role: data.role || 'Utilisateur', // Utiliser Utilisateur comme valeur par défaut
                    nom: data.nom || '',
                    password: data.password || '',
                    secteurs: data.secteurs || [],
                    sectors: data.sectors || [],
                    createdAt: createdAt || new Date(),
                    updatedAt: updatedAt || new Date(),
                } as UserProfile;
                
                console.log(`[getClientUserProfile] Profile constructed:`, profile);
                return profile;
            } 
            // Si le document n'existe pas dans Firestore
            else {
                console.warn(`[getClientUserProfile] No profile found for ID: ${userId}, creating default Admin profile`);
                
                // Créer un profil par défaut avec le rôle Utilisateur
                // Utiliser les informations de la session si disponibles
                const profile = {
                    uid: userId,
                    email: userId.includes('@') ? userId : `${userId}@jdc.fr`,
                    displayName: `Utilisateur ${userId.substring(0, 8)}`,
                    role: 'Utilisateur', // Définir le rôle par défaut à Utilisateur
                    nom: `Utilisateur`,
                    password: '',
                    secteurs: ['Kezia'],
                    sectors: ['HACCP', 'Kezia'],
                    createdAt: new Date(),
                    updatedAt: new Date(),
                } as UserProfile;
                
                console.log(`[getClientUserProfile] Default Admin profile created:`, profile);
                return profile;
            }
        } catch (error) {
            console.error(`[getClientUserProfile] Error fetching profile for ID ${userId}:`, error);
            
            // En cas d'erreur, créer un profil par défaut avec le rôle Utilisateur
            console.log(`[getClientUserProfile] Error occurred, creating default Utilisateur profile`);
            
            const profile = {
                uid: userId,
                email: userId.includes('@') ? userId : `${userId}@jdc.fr`,
                displayName: `Utilisateur ${userId.substring(0, 8)}`,
                role: 'Utilisateur', // Définir le rôle par défaut à Utilisateur
                nom: `Utilisateur`,
                password: '',
                secteurs: ['Kezia'],
                sectors: ['HACCP', 'Kezia'],
                createdAt: new Date(),
                updatedAt: new Date(),
            } as UserProfile;
            
            console.log(`[getClientUserProfile] Default Admin profile created:`, profile);
            return profile;
        }
    }


    // Main App Component wrapped with ToastProvider
    function App({ children }: { children: ReactNode }) {
      // Get user session from the root loader
      const { user } = useLoaderData<typeof loader>(); // user is UserSession | null
      const location = useLocation();
      const navigation = useNavigation();
      const { addToast } = useToast();

      // State for profile fetched client-side
      const [profile, setProfile] = useState<UserProfile | null>(null);
      const [profileLoading, setProfileLoading] = useState(false);

      // State for mobile menu and auth modal (keep these)
      const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
      const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

      // NProgress loading indicator logic
      useEffect(() => {
        if (navigation.state === 'idle' && !profileLoading) { // Only stop if not loading profile
            NProgress.done();
        } else {
            NProgress.start();
        }
       }, [navigation.state, profileLoading]); // Depend on profileLoading too

      // Fetch profile client-side based on Firebase Auth state and server session
      useEffect(() => {
        let isMounted = true;
        const auth = getAuth(clientApp);
        const timeoutRef = { current: null as NodeJS.Timeout | null };
        
        console.log('[Profile Fetch] Initializing profile fetch effect');
        console.log('[Profile Fetch] User from server session:', user);
        
        // Définir profileLoading à true au début
        setProfileLoading(true);
        
        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
          if (!isMounted) return;
          
          console.log('[Profile Fetch] Firebase auth state changed:', firebaseUser);

          // Annuler le délai précédent
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }

          // Délai de 300ms pour stabiliser les changements
          timeoutRef.current = setTimeout(async () => {
            if (!isMounted) return;

            const serverUserId = user?.userId;
            const firebaseUserId = firebaseUser?.uid;
            console.log(`[Auth Check] Firebase: ${firebaseUserId}, Server: ${serverUserId}`);
            
            // Si l'utilisateur n'est pas connecté côté serveur, ne pas essayer de récupérer le profil
            if (!serverUserId) {
              console.log('[Profile Fetch] No server user ID, setting profile to null');
              if (isMounted) {
                setProfile(null);
                setProfileLoading(false);
              }
              return;
            }

            // Synchronisation des états - Utiliser l'ID serveur directement
            if (serverUserId) {
              console.log('[Profile Fetch] Using server ID directly to fetch profile:', serverUserId);
              try {
                const profile = await getClientUserProfile(serverUserId);
                console.log('[Profile Fetch] Profile fetched successfully:', profile);
                if (isMounted) {
                  setProfile(profile);
                  setProfileLoading(false);
                }
              } catch (error) {
                console.error('[Profile Fetch] Profile fetch failed:', error);
                if (isMounted) {
                  setProfile(null);
                  setProfileLoading(false);
                }
              }
            } else {
              console.log('[Profile Fetch] No server user ID available, setting profile to null');
              if (isMounted) {
                setProfile(null);
                setProfileLoading(false);
              }
            }
          }, 300);
        });

        return () => {
          isMounted = false;
          unsubscribe();
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
        };
      }, [user?.userId]);

       const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
       const openAuthModal = () => setIsAuthModalOpen(true); // Keep for Firebase email/pw modal
       const closeAuthModal = () => setIsAuthModalOpen(false);

       // Determine if the current route is the dashboard
       const isDashboard = location.pathname === '/dashboard';

      return (
        <>
          <Header
            user={user} // Pass UserSession | null
            profile={profile} // Pass profile from client-side state
            onToggleMobileMenu={toggleMobileMenu}
            onLoginClick={openAuthModal}
            loadingAuth={navigation.state !== 'idle' || profileLoading} // Indicate loading during navigation or profile fetch
           />
           <MobileMenu
            isOpen={isMobileMenuOpen}
            onClose={toggleMobileMenu}
            user={user} // Pass UserSession | null
            profile={profile} // Pass profile from client-side state
            onLoginClick={openAuthModal}
            loadingAuth={navigation.state !== 'idle' || profileLoading} // Indicate loading during navigation or profile fetch
          />
           <AuthModal isOpen={isAuthModalOpen} onClose={closeAuthModal} /> {/* Keep for modal login */}
           <main className={`container mx-auto px-4 py-6 ${isDashboard ? 'mt-0' : 'mt-16 md:mt-20'}`}>
              {/* Composant de débogage - visible uniquement pour les administrateurs */}
              {profile?.role?.toLowerCase() === 'admin' && (
                <DebugAuth user={user} profile={profile} loadingAuth={navigation.state !== 'idle' || profileLoading} />
              )}
              {/* Render the Outlet and provide context */}
              <Outlet context={{ user }} /> {/* Provide context to child routes */}
           </main>
           <ToastContainer /> {/* Correct: Use the imported default component */}
        </>
      );
    }


    // Document structure
    export default function Document() {
      return (
        <html lang="fr" className="h-full bg-jdc-blue-dark" suppressHydrationWarning={true}>
          <head>
            <meta charSet="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <Meta />
            <Links />
          </head>
          <body className="h-full font-sans text-jdc-gray-300"> {/* Added default text color */}
            <ToastProvider>
               {/* App should wrap the actual content */}
               <App>
                 <Suspense fallback={<div>Chargement de l'application...</div>}>
                   {/* Outlet renders the matched route component */}
                   <Outlet /> {/* Render Outlet directly inside App */}
                 </Suspense>
               </App>
            </ToastProvider>
            <div id="modal-root"></div> {/* Add portal target here */}
            <ScrollRestoration />
            <Scripts />
          </body>
        </html>
      );
    }

    // Error Boundary
    export function ErrorBoundary() {
      return (
        <html lang="fr" className="h-full bg-jdc-blue-dark">
          <head>
            <title>Oops! Une erreur est survenue</title>
            <Meta />
            <Links />
          </head>
          <body className="h-full font-sans text-white flex flex-col items-center justify-center">
             <h1 className="text-2xl font-bold mb-4">Une erreur est survenue</h1>
             <p>Nous sommes désolés, quelque chose s'est mal passé.</p>
             {/* Consider adding more details or a link back home */}
             <Scripts />
          </body>
        </html>
      );
    }
