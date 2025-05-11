import type { LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { searchArticles } from '~/services/firestore.service.server'; // Modifié pour utiliser Firestore
import type { Article as FirestoreArticle } from '~/types/firestore.types'; // Modifié pour utiliser le type Firestore
// Potentially add requireUser or similar if search requires login
// import { requireUser } from '~/services/auth-utils.server';

export async function loader({ request }: LoaderFunctionArgs) {
  // await requireUser(request); // Uncomment if login is required for search

  const url = new URL(request.url);
  const code = url.searchParams.get("code")?.trim() || "";
  const nom = url.searchParams.get("nom")?.trim() || "";

  let articles: FirestoreArticle[] = []; // Utiliser le type FirestoreArticle
  let error: string | null = null; // Explicitly type error

  // Only search if criteria are provided
  if (code || nom) {
    try {
      console.log("[Articles Loader] Searching Firestore for:", { code, nom });
      // Utiliser searchArticles de firestore.service.server
      articles = await searchArticles({ code, nom });
      console.log("[Articles Loader] Found articles in Firestore:", articles.length);
    } catch (err: any) {
      console.error("[Articles Loader] Firestore search error:", err);
      error = err.message || "Erreur lors de la recherche d'articles dans Firestore.";
    }
  } else {
     console.log("[Articles Loader] No search criteria provided.");
  }

  // Return search params along with results/error
  return json({ searchParams: { code, nom }, articles, error });
}
