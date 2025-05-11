import type { EntryContext } from "@remix-run/node";
import { RemixServer } from "@remix-run/react";
import { renderToString } from "react-dom/server";
import { setupNotificationTriggers } from "~/services/sap.service.server"; // Importer la fonction
import { initializeFirebaseAdmin } from "~/firebase.admin.config.server"; // S'assurer que Firebase est initialisé

// Initialiser Firebase Admin et les triggers de notification une seule fois au démarrage du serveur.
// Cela peut être fait en dehors de la fonction handleRequest si le module est évalué une seule fois.
// Ou, pour s'assurer que cela se produit avant la première requête, on peut le mettre ici.
let serverInitialized = false;
async function initializeServer() {
  if (!serverInitialized) {
    await initializeFirebaseAdmin(); // S'assurer que Firebase est prêt
    await setupNotificationTriggers(); // Configurer les listeners de notification
    serverInitialized = true;
    console.log("[entry.server] Firebase Admin et Triggers de Notification initialisés.");
  }
}
initializeServer().catch(console.error); // Appeler à l'initialisation du module

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  // On s'assure que l'initialisation a eu lieu, bien que l'appel ci-dessus devrait suffire.
  // Si initializeServer() est asynchrone et doit absolument terminer avant chaque requête,
  // il faudrait l'await ici, mais cela pourrait ralentir la première requête.
  // Pour des listeners, l'initialisation au démarrage du module est généralement suffisante.

  const markup = renderToString(
    <RemixServer context={remixContext} url={request.url} />
  );

  // Inject styles into the head
  const html = `<!DOCTYPE html>${markup.replace(
    '</head>',
    `</head>`
  )}`;

  responseHeaders.set("Content-Type", "text/html");
  return new Response(html, {
    status: responseStatusCode,
    headers: responseHeaders,
  });
}
