import type { EntryContext } from "@remix-run/node";
import { RemixServer } from "@remix-run/react";
import { renderToString } from "react-dom/server";
import { dom } from '@fortawesome/fontawesome-svg-core';

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  const markup = renderToString(
    <RemixServer context={remixContext} url={request.url} />
  );

  // Collect Font Awesome server styles
  const styles = dom.css();

  // Inject styles into the head
  const html = `<!DOCTYPE html>${markup.replace(
    '</head>',
    `${styles}</head>`
  )}`;

  responseHeaders.set("Content-Type", "text/html");
  return new Response(html, {
    status: responseStatusCode,
    headers: responseHeaders,
  });
}
