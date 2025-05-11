import { createCookieSessionStorage } from "@remix-run/node";
import type { UserProfile } from "~/types/firestore.types";

export type UserSessionData = { // Renommé pour clarté, c'est les données de l'utilisateur
  userId: string;
  email: string;
  displayName: string;
  role: string;
  secteurs: string[];
  googleRefreshToken?: string;
};

// Le type de données stocké dans la session par Remix Auth est { user: UserSessionData | null }
export type SessionShape = {
  user: UserSessionData | null;
};

const SECRET = process.env.SESSION_SECRET || import.meta.env.VITE_SESSION_SECRET || "default-secret-key-please-change-in-production";

export const sessionStorage = createCookieSessionStorage<SessionShape>({ // Utiliser SessionShape ici
  cookie: {
    name: "__session",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secrets: [SECRET],
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
});

export async function getSession(request: Request) {
  try {
    const cookieHeader = request.headers.get("Cookie");
    // getSession retourne maintenant Session<SessionShape, unknown>
    const session = await sessionStorage.getSession(cookieHeader); 
    
    // La fonction getSession n'a plus besoin de reconstruire l'utilisateur,
    // car il sera directement accessible via session.get("user")
    return session;
    
  } catch (error) {
    console.error("Session error in getSession:", error);
    // Retourner une session vide en cas d'erreur de parsing du cookie, etc.
    return sessionStorage.getSession(); // Retourne une session vide
  }
}

export const { commitSession, destroySession } = sessionStorage;

export async function commitLongSession(session: any) {
  return await commitSession(session, {
    maxAge: 60 * 60 * 24 * 30 // 30 days
  });
}
