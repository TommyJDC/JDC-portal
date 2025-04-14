import type { LoaderFunctionArgs } from '@remix-run/node';
    import { json } from '@remix-run/node';
    import { searchArticles } from '~/services/firestore.service.server';
    import type { Article } from '~/types/firestore.types'; // Import Article type
    // Potentially add requireUser or similar if search requires login
    // import { requireUser } from '~/services/auth-utils.server';

    export async function loader({ request }: LoaderFunctionArgs) {
      // await requireUser(request); // Uncomment if login is required for search

      const url = new URL(request.url);
      const code = url.searchParams.get("code")?.trim() || "";
      const nom = url.searchParams.get("nom")?.trim() || "";

      let articles: Article[] = []; // Explicitly type articles
      let error: string | null = null; // Explicitly type error

      // Only search if criteria are provided
      if (code || nom) {
        try {
          console.log("[Articles Loader] Searching for:", { code, nom });
          articles = await searchArticles({ code, nom });
          console.log("[Articles Loader] Found articles:", articles.length);
        } catch (err: any) {
          console.error("[Articles Loader] Search error:", err);
          error = err.message || "Erreur lors de la recherche d'articles.";
        }
      } else {
         console.log("[Articles Loader] No search criteria provided.");
      }

      // Return search params along with results/error
      return json({ searchParams: { code, nom }, articles, error });
    }
