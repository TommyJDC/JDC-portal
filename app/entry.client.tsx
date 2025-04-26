import { RemixBrowser } from "@remix-run/react";
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";

// Import FontAwesome config and disable auto CSS addition
import { config } from '@fortawesome/fontawesome-svg-core';
config.autoAddCss = false;

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <RemixBrowser />
    </StrictMode>
  );
});
