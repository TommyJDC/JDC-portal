import { useState, useEffect, type ReactNode } from "react";

/**
 * Props for the ClientOnly component.
 * Uses a function as children to defer rendering until mounted on the client.
 */
interface ClientOnlyProps {
  children: () => ReactNode;
  fallback?: ReactNode;
}

/**
 * Renders children only on the client side after component has mounted.
 * Useful for wrapping components that depend heavily on browser APIs (like Leaflet).
 */
export function ClientOnly({ children, fallback = null }: ClientOnlyProps): ReactNode {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // This effect runs only on the client after the initial render
    setIsMounted(true);
  }, []);

  // If not mounted yet (i.e., on the server or during initial client render before effect), render fallback
  if (!isMounted) {
    return fallback;
  }

  // Once mounted, render the actual children by calling the function
  return children();
}

// Optional: Export as default if preferred
// export default ClientOnly;
