import { ActionFunctionArgs } from "@remix-run/node";
import { destroyUserSession } from "~/services/auth.server";

export async function action({ request }: ActionFunctionArgs) {
  return destroyUserSession(request);
}

export default function Logout() {
  return null;
}
