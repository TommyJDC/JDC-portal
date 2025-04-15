import { json, type LoaderFunctionArgs } from "@remix-run/node";

// Simple health check endpoint
export const loader = async ({ request }: LoaderFunctionArgs) => {
  console.log(`API Health Check Request: ${request.url}`);
  return json({ status: "ok" }, 200);
};

// Optional: Handle POST or other methods if needed, otherwise they'll 405
// export const action = async ({ request }: ActionFunctionArgs) => {
//   return json({ message: "Method Not Allowed" }, 405);
// };
