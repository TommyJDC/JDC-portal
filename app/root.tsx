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

     import { Header } from "~/components/Header";
    import { MobileMenu } from "~/components/MobileMenu";
    import { AuthModal } from "~/components/AuthModal";
    import ToastContainer from '~/components/Toast'; // Correct: Import default export
    import { ToastProvider, useToast } from '~/context/ToastContext'; // Import ToastProvider and useToast
    // Firebase client-side auth imports are removed
    import type { UserProfile } from '~/types/firestore.types'; // Keep UserProfile type
    // Re-introduce client SDK imports for profile fetching
    import { getFirestore, doc, getDoc, Timestamp } from 'firebase/firestore';
    import { db as clientDb } from '~/firebase.config'; // Import client db instance
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
        if (!userId) return null;
        console.log(`[getClientUserProfile] Fetching profile client-side for ID: ${userId}`);
        try {
            const userDocRef = doc(clientDb, 'users', userId); // Use clientDb
            const userDocSnap = await getDoc(userDocRef);

            if (userDocSnap.exists()) {
                const data = userDocSnap.data();
                // Convert Timestamps to Dates
                const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : undefined;
                const updatedAt = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : undefined;
                console.log(`[getClientUserProfile] Profile found for ID: ${userId}`);
                return {
                    uid: userId, // Use the passed userId as uid
                    email: data.email,
                    displayName: data.displayName,
                    role: data.role,
                    secteurs: data.secteurs,
                    createdAt: createdAt,
                    updatedAt: updatedAt,
                } as UserProfile;
            } else {
                console.warn(`[getClientUserProfile] No profile found for ID: ${userId}`);
                return null; // Return null if profile doesn't exist
            }
        } catch (error) {
            console.error(`[getClientUserProfile] Error fetching profile for ID ${userId}:`, error);
            // Re-throw or return null based on how you want to handle errors
            throw new Error(`Impossible de récupérer le profil client (ID: ${userId}).`);
            // return null;
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

      // Fetch profile client-side when user session changes
      useEffect(() => {
        let isMounted = true;
        const fetchProfile = async () => {
          // Use userId from the session object loaded by the root loader
          const currentUserId = user?.userId;

          if (currentUserId) {
            console.log(`[App Effect] User session found (userId: ${currentUserId}). Fetching profile client-side...`);
            setProfileLoading(true);
            setProfile(null); // Clear previous profile while fetching
            try {
              // Use the actual client-side fetch function
              const clientProfile = await getClientUserProfile(currentUserId);
              if (isMounted) {
                  setProfile(clientProfile); // Set profile (or null if not found)
                  if (!clientProfile) {
                      console.warn(`[App Effect] Profile not found client-side for userId: ${currentUserId}`);
                      // Optionally show a toast if profile not found after login
                      // addToast({ message: 'Profil utilisateur non trouvé.', type: 'warning' });
                  }
              }
            } catch (error: any) {
              console.error("[App Effect] Error fetching profile client-side:", error);
              if (isMounted) setProfile(null);
              addToast({ message: `Erreur chargement profil: ${error.message}`, type: 'error' });
            } finally {
              if (isMounted) setProfileLoading(false);
            }
          } else {
            console.log("[App Effect] No user session, clearing profile.");
            if (isMounted) {
                setProfile(null);
                setProfileLoading(false); // Ensure loading is false if no user
            }
          }
        };

        fetchProfile();

        return () => { isMounted = false; };
      }, [user, addToast]); // Re-run when user session changes

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
              {/* Pass user session and client-fetched profile to Outlet context */}
              <Outlet context={{ user, profile, profileLoading }} />
           </main>
           <ToastContainer /> {/* Correct: Use the imported default component */}
        </>
      );
    }


    // Document structure
    export default function Document() {
      return (
        <html lang="fr" className="h-full bg-jdc-blue-dark">
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
