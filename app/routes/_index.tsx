import { redirect } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";

// Redirect root path ("/") to the dashboard
export const loader = async ({ request }: LoaderFunctionArgs) => {
  // In a real app, you might check authentication status here
  // const session = await getSession(request.headers.get("Cookie"));
  // if (!session.has("userId")) {
  //   return redirect("/login");
  // }
  return redirect("/dashboard");
};

// This component should technically never render due to the redirect,
// but it's good practice to have a fallback.
export default function Index() {
  return (
    <div className="p-6 text-center">
      <h1 className="text-xl text-jdc-gray-300">Redirection vers le tableau de bord...</h1>
      {/* You could add a loading spinner here */}
    </div>
  );
}
