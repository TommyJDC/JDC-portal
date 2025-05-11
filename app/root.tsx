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
} from "@remix-run/react";
import type { LinksFunction, LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import * as NProgress from 'nprogress';
import tailwindStylesHref from "~/tailwind.css?url";
import globalStylesHref from "~/styles/global.css?url";
import nProgressStylesHref from "nprogress/nprogress.css?url";
import mapboxStylesHref from 'mapbox-gl/dist/mapbox-gl.css?url';

import { DebugAuth } from "~/components/DebugAuth";
import { MobileMenu } from "~/components/MobileMenu";
import { AuthModal } from "~/components/AuthModal";
import ToastContainer from '~/components/Toast';
import { ToastProvider } from '~/context/ToastContext';
import type { UserProfile } from '~/types/firestore.types';
import type { UserSessionData } from "~/services/session.server";
import { sessionStorage } from "~/services/session.server";
import { getUserProfileSdk, createUserProfileSdk } from "~/services/firestore.service.server";
import { Sidebar, MobileNavBar } from "~/components/Sidebar";

type SerializableUserProfile = Omit<UserProfile, 'createdAt' | 'updatedAt'> & {
  createdAt: string | null;
  updatedAt: string | null;
};

export const links: LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" },
  { rel: "stylesheet", href: tailwindStylesHref },
  { rel: "stylesheet", href: globalStylesHref },
  { rel: "stylesheet", href: nProgressStylesHref },
  { rel: "stylesheet", href: mapboxStylesHref },
  { rel: "manifest", href: "/manifest.json" },
  { rel: "apple-touch-icon", href: "/icons/ios/180.png" },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  console.log("\n--- DÉBUT Root Loader ---");
  console.log("Root Loader: URL de la requête:", request.url);
  
  const cookieHeader = request.headers.get("Cookie");
  console.log("Root Loader: Cookies présents:", cookieHeader ? "Oui" : "Non");
  if (cookieHeader) {
    console.log("Root Loader: Cookie header length:", cookieHeader.length);
    const sessionCookieMatch = cookieHeader.match(/__session=([^;]+)/);
    if (sessionCookieMatch) {
      console.log("Root Loader: __session cookie trouvé, longueur:", sessionCookieMatch[1].length);
    } else {
      console.log("Root Loader: __session cookie NON trouvé dans l'en-tête");
    }
  }
  
  try {
    let userSessionData: UserSessionData | null = null;
    
    if (cookieHeader) {
      try {
        const directSession = await sessionStorage.getSession(cookieHeader);
        console.log("Root Loader: Contenu brut de directSession.data:", JSON.stringify(directSession.data, null, 2));
        const userFromSession = directSession.get("user"); 
        if (userFromSession && userFromSession.userId) {
          console.log("Root Loader: Session valide trouvée via directSession.get('user'). UserID:", userFromSession.userId);
          userSessionData = userFromSession;
        } else {
          console.log("Root Loader: Aucune donnée utilisateur (valide) trouvée dans la session via la clé 'user'.");
        }
      } catch (e: any) {
        console.error("Root Loader: Erreur lors de la vérification directe du cookie:", e.message);
      }
    }
    
    let profile: UserProfile | null = null;
    
    if (userSessionData) {
      console.log(`Root Loader: Utilisateur authentifié (ID: ${userSessionData.userId})`);
      console.log(`Root Loader: Email: ${userSessionData.email}`);
      console.log(`Root Loader: Display Name: ${userSessionData.displayName}`);
      console.log(`Root Loader: Role: ${userSessionData.role}`);
      
      try { // Try pour toute la logique de récupération/création de profil Firestore
        let firestoreProfile = await getUserProfileSdk(userSessionData.userId);
        
        if (firestoreProfile) {
          profile = firestoreProfile;
          console.log("Root Loader: Profil Firestore récupéré avec succès");
          console.log(`Root Loader: Rôle Firestore: ${profile.role}, Secteurs: ${profile.secteurs?.join(', ') || 'aucun'}`);
        } else {
          console.warn(`Root Loader: Profil Firestore non trouvé pour ${userSessionData.userId}, tentative de création.`);
          const isAdmin = userSessionData.email === 'tommy.vilmen@jdc.fr';
          const newProfileData: UserProfile = {
            uid: userSessionData.userId,
            email: userSessionData.email || "",
            displayName: userSessionData.displayName || "",
            role: userSessionData.role || (isAdmin ? 'Admin' : 'User'),
            secteurs: userSessionData.secteurs || (isAdmin ? ['CHR', 'HACCP', 'Kezia', 'Tabac'] : []),
            nom: userSessionData.displayName || "",
            phone: "",
            address: "",
            blockchainAddress: "",
            department: "",
            encryptedWallet: "",
            gmailAuthStatus: "unauthorized",
            gmailAuthorizedScopes: [],
            googleRefreshToken: userSessionData.googleRefreshToken || "",
            isGmailProcessor: false,
            jobTitle: "",
            labelSapClosed: "",
            labelSapNoResponse: "",
            labelSapRma: "",
            // createdAt et updatedAt seront gérés par createUserProfileSdk lors de l'écriture
          };
          await createUserProfileSdk(newProfileData); // Laisser createUserProfileSdk gérer les timestamps
          profile = await getUserProfileSdk(userSessionData.userId); // Relire pour obtenir le profil complet avec timestamps
          if (profile) {
               console.log("Root Loader: Profil créé et relu avec succès:", JSON.stringify(profile, null, 2));
          } else {
              console.error("Root Loader: Profil créé mais relecture a échoué pour UID:", userSessionData.userId);
          }
        }
      } catch (error: any) { 
        console.error("Root Loader: Erreur lors de la gestion du profil Firestore (récupération/création):", error.message, error);
        profile = null; 
      }
    } else {
      console.log("Root Loader: Utilisateur non authentifié (userSessionData est null).");
    }
    
    const serializableProfile: SerializableUserProfile | null = profile ? {
      ...profile,
      createdAt: profile.createdAt instanceof Date ? profile.createdAt.toISOString() : null,
      updatedAt: profile.updatedAt instanceof Date ? profile.updatedAt.toISOString() : null,
    } : null;
    
    console.log("Root Loader: Données retournées:", {
      user: userSessionData, 
      profile: serializableProfile 
    });
    console.log("--- FIN Root Loader ---\n");
    
    return json({ user: userSessionData, profile: serializableProfile });
  } catch (error: any) {
    console.error("Root Loader: Erreur critique:", error.message, error);
    console.log("--- FIN Root Loader (avec erreur) ---\n");
    return json({ user: null, profile: null });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const action = formData.get("_action");
  console.warn("Root Action: Received unexpected action:", action);
  return json({ ok: false, error: "Invalid root action" }, { status: 400 });
};

function App({ children }: { children: ReactNode }) {
  const { user, profile } = useLoaderData<{ user: UserSessionData | null; profile: SerializableUserProfile | null }>();
  const location = useLocation();
  const navigation = useNavigation();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    if (navigation.state === 'idle') {
      NProgress.done();
    } else {
      NProgress.start();
    }
  }, [navigation.state]);

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
  const openAuthModal = () => setIsAuthModalOpen(true);
  const closeAuthModal = () => setIsAuthModalOpen(false);

  const profileForComponents = profile as UserProfile | null;

  return (
    <>
      <Sidebar
        user={user}
        profile={profileForComponents}
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />
      <MobileMenu
        isOpen={isMobileMenuOpen}
        onClose={toggleMobileMenu}
        user={user}
        profile={profileForComponents}
        onLoginClick={openAuthModal}
        loadingAuth={navigation.state !== 'idle'}
      />
      <AuthModal isOpen={isAuthModalOpen} onClose={closeAuthModal} />
      <main className={`px-4 py-6 mt-4 md:mt-0 transition-all duration-300 md:ml-64`}>
        <Outlet context={{ user, profile: profileForComponents }} />
      </main>
      <ToastContainer />
      <MobileNavBar profile={profileForComponents} />
    </>
  );
}

export default function Document() {
  return (
    <html lang="fr" className="h-full" suppressHydrationWarning={true}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#000000" />
        <meta name="description" content="Portail de gestion JDC" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black" />
        <Meta />
        <Links />
      </head>
      <body className="h-full font-sans">
        <ToastProvider>
          <App>
            <Suspense fallback={<div>Chargement de l'application...</div>}>
              <Outlet />
            </Suspense>
          </App>
        </ToastProvider>
        <div id="modal-root"></div>
        <ScrollRestoration />
        <Scripts />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js')
                    .then(registration => {
                      console.log('SW registered:', registration);
                    })
                    .catch(error => {
                      console.log('SW registration failed:', error);
                    });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}

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
        <Scripts />
      </body>
    </html>
  );
}
