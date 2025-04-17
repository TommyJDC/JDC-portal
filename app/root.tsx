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
import { json } from "@remix-run/node"; // Removed redirect as it's not used
import * as NProgress from 'nprogress';
import tailwindStylesHref from "~/tailwind.css?url";
import globalStylesHref from "~/styles/global.css?url";
import nProgressStylesHref from "nprogress/nprogress.css?url";
import mapboxStylesHref from 'mapbox-gl/dist/mapbox-gl.css?url';
import fontAwesomeStylesHref from '@fortawesome/fontawesome-svg-core/styles.css?url';

import { Header } from "~/components/Header";
import { DebugAuth } from "~/components/DebugAuth";
import { MobileMenu } from "~/components/MobileMenu";
import { AuthModal } from "~/components/AuthModal";
import ToastContainer from '~/components/Toast';
import { ToastProvider } from '~/context/ToastContext'; // Removed useToast as it's not used directly here
import type { UserProfile } from '~/types/firestore.types'; // Use the original UserProfile type
import { authenticator } from "~/services/auth.server";
import type { UserSession } from "~/services/session.server";
import { getUserProfileSdk } from '~/services/firestore.service.server';

// Define a serializable version of UserProfile for loader return type
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
  { rel: "stylesheet", href: fontAwesomeStylesHref },
];

// --- Root Loader: Load user session AND profile server-side ---
export const loader = async ({ request }: LoaderFunctionArgs) => {
  console.log("Root Loader: Checking authentication state via remix-auth.");
  const userSession = await authenticator.isAuthenticated(request);

  let profile: UserProfile | null = null;

  if (userSession) {
    console.log(`Root Loader: User authenticated (ID: ${userSession.userId}). Fetching profile server-side.`);
    try {
      profile = await getUserProfileSdk(userSession.userId);
      console.log("Root Loader: Profile fetched successfully server-side.");
    } catch (error: any) {
      console.error("Root Loader: Error fetching profile server-side:", error.message);
      if (error.message?.includes("User profile not found")) {
        console.warn(`Root Loader: Profile not found in Firestore for user ID: ${userSession.userId}`);
      }
      profile = null;
    }
  } else {
    console.log("Root Loader: User not authenticated.");
  }

  // Convert Date objects to ISO strings for serialization
  const serializableProfile: SerializableUserProfile | null = profile ? {
    ...profile,
    // Ensure properties exist before accessing them
    createdAt: profile.createdAt instanceof Date ? profile.createdAt.toISOString() : null,
    updatedAt: profile.updatedAt instanceof Date ? profile.updatedAt.toISOString() : null,
  } : null;

  console.log("Root Loader: Returning data:", { user: userSession, profile: serializableProfile });
  // Return the serializable profile
  return json({ user: userSession, profile: serializableProfile });
};

// --- Root Action ---
export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const action = formData.get("_action");
  console.warn("Root Action: Received unexpected action:", action);
  return json({ ok: false, error: "Invalid root action" }, { status: 400 });
};

// --- Client-side Profile Fetch Function (REMOVED) ---

// Main App Component wrapped with ToastProvider
function App({ children }: { children: ReactNode }) {
  // Get user session AND profile from the root loader
  // Use the SerializableUserProfile type here as returned by the loader
  const { user, profile } = useLoaderData<{ user: UserSession | null; profile: SerializableUserProfile | null }>();
  const location = useLocation();
  const navigation = useNavigation();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // NProgress loading indicator logic (simplified)
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

  const isDashboard = location.pathname === '/dashboard';

  // Cast the serializable profile back to UserProfile for components that expect it
  // Note: Dates will still be strings, but the structure matches.
  // Components needing actual Date objects would need further adjustment or client-side parsing.
  const profileForComponents = profile as UserProfile | null;

  return (
    <>
      <Header
        user={user}
        profile={profileForComponents} // Pass casted profile
        onToggleMobileMenu={toggleMobileMenu}
        onLoginClick={openAuthModal}
        loadingAuth={navigation.state !== 'idle'}
      />
      <MobileMenu
        isOpen={isMobileMenuOpen}
        onClose={toggleMobileMenu}
        user={user}
        profile={profileForComponents} // Pass casted profile
        onLoginClick={openAuthModal}
        loadingAuth={navigation.state !== 'idle'}
      />
      <AuthModal isOpen={isAuthModalOpen} onClose={closeAuthModal} />
      <main className={`container mx-auto px-4 py-6 ${isDashboard ? 'mt-0' : 'mt-16 md:mt-20'}`}>
        {/* Pass casted profile to Outlet context */}
        <Outlet context={{ user, profile: profileForComponents }} />
      </main>
      <ToastContainer />
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
      <body className="h-full font-sans text-jdc-gray-300">
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
      </body>
    </html>
  );
}

// Error Boundary
export function ErrorBoundary() {
  // Basic error boundary, consider enhancing
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
