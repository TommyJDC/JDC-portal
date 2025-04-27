import type { EntryContext } from "@remix-run/node";
import { RemixServer } from "@remix-run/react";
import { renderToString } from "react-dom/server";

// Log des variables d'environnement au démarrage du serveur
console.log("DEBUG ENV VARS:");
console.log("GOOGLE_CLIENT_ID:", process.env.GOOGLE_CLIENT_ID);
console.log("GOOGLE_CLIENT_SECRET:", process.env.GOOGLE_CLIENT_SECRET);
console.log("APP_BASE_URL:", process.env.APP_BASE_URL);
console.log("DEBUG ENV VARS END");


export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
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
