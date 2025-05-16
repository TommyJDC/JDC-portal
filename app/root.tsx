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

// Importer les futurs composants Header et Sidebar (qui seront adaptés au nouveau design)
import { Header } from "~/components/Header"; 
import { Sidebar } from "~/components/Sidebar"; 
import { MobileMenu } from "~/components/MobileMenu";
import { AuthModal } from "~/components/AuthModal";
import ToastContainer from '~/components/Toast';
import { ToastProvider } from '~/context/ToastContext';
import type { UserProfile } from '~/types/firestore.types';
import type { UserSessionData } from "~/services/session.server";
import { sessionStorage } from "~/services/session.server";
import { getUserProfileSdk, createUserProfileSdk } from "~/services/firestore.service.server";
import { startScheduledTasks, stopScheduledTasks } from "~/services/scheduler.service";

// MobileNavBar n'est plus utilisé dans ce nouveau design
// import { MobileNavBar } from "~/components/Sidebar"; 

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
  // ... (loader function reste inchangée pour l'instant)
  console.log("\n--- DÉBUT Root Loader ---");
  const cookieHeader = request.headers.get("Cookie");
  let userSessionData: UserSessionData | null = null;
  if (cookieHeader) {
    try {
      const directSession = await sessionStorage.getSession(cookieHeader);
      const userFromSession = directSession.get("user"); 
      if (userFromSession && userFromSession.userId) {
        userSessionData = userFromSession;
      }
    } catch (e: any) {
      console.error("Root Loader: Erreur session:", e.message);
    }
  }
  let profile: UserProfile | null = null;
  if (userSessionData) {
    try {
      let firestoreProfile = await getUserProfileSdk(userSessionData.userId);
      if (!firestoreProfile) {
        const isAdmin = userSessionData.email === 'tommy.vilmen@jdc.fr'; // Exemple
        const newProfileData: UserProfile = { /* ... données de base ... */ } as UserProfile;
        await createUserProfileSdk(newProfileData);
        profile = await getUserProfileSdk(userSessionData.userId);
      } else {
        profile = firestoreProfile;
      }
    } catch (error: any) { 
      console.error("Root Loader: Erreur Firestore:", error.message);
      profile = null; 
    }
  }
  const serializableProfile: SerializableUserProfile | null = profile ? {
    ...profile,
    createdAt: profile.createdAt instanceof Date ? profile.createdAt.toISOString() : null,
    updatedAt: profile.updatedAt instanceof Date ? profile.updatedAt.toISOString() : null,
  } : null;
  console.log("--- FIN Root Loader ---\n");
  return json({ user: userSessionData, profile: serializableProfile });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  // ... (action function reste inchangée)
  return json({ ok: false, error: "Invalid root action" }, { status: 400 });
};

function App({ children }: { children: ReactNode }) {
  const { user, profile } = useLoaderData<{ user: UserSessionData | null; profile: SerializableUserProfile | null }>();
  const location = useLocation();
  const navigation = useNavigation();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    if (navigation.state === 'idle') NProgress.done();
    else NProgress.start();
  }, [navigation.state]);

  // Démarrer les tâches planifiées au chargement de l'application
  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined;

    const startTasks = async () => {
      try {
        intervalId = await startScheduledTasks();
      } catch (error) {
        console.error('Erreur lors du démarrage des tâches planifiées:', error);
      }
    };

    startTasks();

    return () => {
      if (intervalId) {
        stopScheduledTasks(intervalId);
      }
    };
  }, []);

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
  const openAuthModal = () => setIsAuthModalOpen(true);
  const closeAuthModal = () => setIsAuthModalOpen(false);

  const profileForComponents = profile as UserProfile | null;

  // Nouvelle structure de layout pour le design "gestionnaire d'applications"
  return (
    <div className="flex flex-col h-screen text-text-primary"> {/* bg-ui-background retiré ici */}
      <Header 
        user={user} 
        profile={profileForComponents} 
        onMobileMenuToggle={toggleMobileMenu} 
        onLoginClick={openAuthModal} 
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar 
          user={user} 
          profile={profileForComponents} 
          // Les props isOpen/onClose ne sont plus pour la sidebar principale fixe à gauche
          // Elles pourraient être réutilisées si la sidebar est aussi le menu mobile,
          // mais nous avons un MobileMenu séparé.
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6"> {/* Ajuster le padding si besoin */}
          <Outlet context={{ user, profile: profileForComponents }} />
        </main>
      </div>
      <MobileMenu
        isOpen={isMobileMenuOpen}
        onClose={toggleMobileMenu}
        user={user}
        profile={profileForComponents}
        onLoginClick={openAuthModal}
        loadingAuth={navigation.state !== 'idle'}
      />
      <AuthModal isOpen={isAuthModalOpen} onClose={closeAuthModal} />
      <ToastContainer />
    </div>
  );
}

export default function Document() {
  return (
    <html lang="fr" className="h-full" suppressHydrationWarning={true}>
      <head><meta charSet="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><meta name="theme-color" content="#111827" /><meta name="description" content="Portail de gestion JDC" /><Meta /><Links /></head>
      <body 
        className="h-full font-sans"
        style={{
          backgroundColor: '#111827',
          backgroundImage: `
            radial-gradient(ellipse 80% 50% at 50% -20%, rgba(59, 130, 246, 0.2), transparent),
            radial-gradient(ellipse 80% 50% at 10% 100%, rgba(234, 179, 8, 0.15), transparent),
            radial-gradient(ellipse 80% 50% at 90% 100%, rgba(234, 179, 8, 0.15), transparent)
          `,
          backgroundAttachment: 'fixed',
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'cover',
        }}
      >
        <ToastProvider>
          <App>
            <Suspense fallback={<div className="flex justify-center items-center h-screen text-text-primary">Chargement de l'application...</div>}>
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
                  navigator.serviceWorker.register('/sw.js').catch(error => {
                    console.error('Erreur lors de l\'enregistrement du service worker:', error);
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
    <html lang="fr" className="h-full bg-ui-background">
      <head>
        <title>Oops! Une erreur est survenue</title>
        <meta charSet="utf-8" />
        <Meta />
        <Links />
      </head>
      <body className="h-full font-sans text-text-primary flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold mb-4 text-brand-blue-light">Une erreur est survenue</h1>
        <p className="text-center">Nous sommes désolés, quelque chose s&apos;est mal passé sur le portail JDC.</p>
        <Scripts />
      </body>
    </html>
  );
}
