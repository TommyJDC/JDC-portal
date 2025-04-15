import { RemixBrowser } from "@remix-run/react";
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";

// Import FontAwesome config and disable auto CSS addition
import { config } from '@fortawesome/fontawesome-svg-core';
import '@fortawesome/fontawesome-svg-core/styles.css'; // Import the CSS
config.autoAddCss = false;

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <RemixBrowser />
    </StrictMode>
  );
});
