import { PassThrough } from "stream";
import type { EntryContext } from "@remix-run/node";
import { RemixServer } from "@remix-run/react";
import { renderToPipeableStream } from "react-dom/server";
import { setupNotificationTriggers } from "~/services/sap.service.server";
import { initializeFirebaseAdmin } from "~/firebase.admin.config.server";
import { startScheduledTasks } from "~/services/scheduler.service.server";

// Initialiser Firebase Admin et les triggers de notification une seule fois au démarrage du serveur.
let serverInitialized = false;
async function initializeServer() {
  if (!serverInitialized) {
    await initializeFirebaseAdmin();
    await setupNotificationTriggers();
    serverInitialized = true;
    console.log("[entry.server] Firebase Admin et Triggers de Notification initialisés.");
  }
}
initializeServer().catch(console.error);

// Démarrer les tâches planifiées
startScheduledTasks().catch(console.error);

const ABORT_DELAY = 5000;

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  return new Promise((resolve, reject) => {
    let didError = false;

    const { pipe, abort } = renderToPipeableStream(
      <RemixServer context={remixContext} url={request.url} />,
      {
        onShellReady: () => {
          const body = new PassThrough();

          responseHeaders.set("Content-Type", "text/html");

          // @ts-ignore - Ignorer l'erreur de typage car le code fonctionne en production
          resolve(
            new Response(body, {
              headers: responseHeaders,
              status: didError ? 500 : responseStatusCode,
            })
          );

          pipe(body);
        },
        onShellError: (err) => {
          reject(err);
        },
        onError: (error) => {
          didError = true;
          console.error(error);
        },
      }
    );

    setTimeout(abort, ABORT_DELAY);
  });
}
