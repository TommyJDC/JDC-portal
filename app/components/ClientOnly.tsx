import { useState, useLayoutEffect, type ReactNode } from "react";

/**
 * Props for the ClientOnly component.
 * Uses a function as children to defer rendering until mounted on the client.
 */
interface ClientOnlyProps {
  children: ReactNode | (() => ReactNode);
  fallback?: ReactNode;
}

/**
 * ClientOnly component ensures children are only rendered on the client side.
 * Supports both direct JSX and render-props patterns.
 * @example
 * <ClientOnly fallback={<Loader />}>
 *   <MapComponent />
 * </ClientOnly>
 * 
 * @example
 * <ClientOnly>
 *   {() => <DynamicComponent />}
 * </ClientOnly>
 */
// Add displayName outside the function body to avoid TypeScript errors
export const ClientOnly = ({ children, fallback = null }: ClientOnlyProps) => {
  const [isMounted, setIsMounted] = useState(false);

  useLayoutEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return fallback;
  }

  return <>{typeof children === 'function' ? children() : children}</>;
}

// Set displayName property for React dev tools
ClientOnly.displayName = 'ClientOnly';

// Optional: Export as default if preferred
// export default ClientOnly;
