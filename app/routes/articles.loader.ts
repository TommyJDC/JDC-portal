import type { LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { searchArticles } from '~/services/firestore.service.server'; // Modifié pour utiliser Firestore
import type { Article as FirestoreArticle } from '~/types/firestore.types'; // Modifié pour utiliser le type Firestore
// Potentially add requireUser or similar if search requires login
// import { requireUser } from '~/services/auth-utils.server';

export async function loader({ request }: LoaderFunctionArgs) {
  console.log("%c[Articles Loader] Starting loader", "color: #ff0000; font-weight: bold;");

  const url = new URL(request.url);
  const code = url.searchParams.get("code")?.trim() || "";
  const nom = url.searchParams.get("nom")?.trim() || "";

  console.log("%c[Articles Loader] Search params:", "color: #ff0000; font-weight: bold;", { code, nom });

  let articles: FirestoreArticle[] = [];
  let error: string | null = null;

  if (code || nom) {
    try {
      console.log("%c[Articles Loader] Starting search in Firestore...", "color: #ff0000; font-weight: bold;");
      articles = await searchArticles({ code, nom });
      console.log("%c[Articles Loader] Search completed. Found articles:", "color: #ff0000; font-weight: bold;", articles.length);
      
      articles.forEach((article, index) => {
        console.log(`%c[Articles Loader] Article ${index + 1}:`, "color: #ff0000; font-weight: bold;", {
          id: article.id,
          Code: article.Code,
          Désignation: article.Désignation,
          type: article.type,
          category: article.category,
          imagesCount: article.images?.length || 0
        });
      });

      const invalidArticles = articles.filter(article => 
        !article.Code || !article.Désignation
      );
      
      if (invalidArticles.length > 0) {
        console.warn("%c[Articles Loader] Found articles with missing required fields:", "color: #ff0000; font-weight: bold;", invalidArticles);
      }

    } catch (err: any) {
      console.error("%c[Articles Loader] Firestore search error:", "color: #ff0000; font-weight: bold;", err);
      error = err.message || "Erreur lors de la recherche d'articles dans Firestore.";
    }
  } else {
    console.log("%c[Articles Loader] No search criteria provided.", "color: #ff0000; font-weight: bold;");
  }

  const response = { searchParams: { code, nom }, articles, error };
  console.log("%c[Articles Loader] Final response:", "color: #ff0000; font-weight: bold;", JSON.stringify(response, null, 2));
  
  return json(response);
}
