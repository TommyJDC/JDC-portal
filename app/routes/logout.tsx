import { ActionFunctionArgs, redirect } from "@remix-run/node";
import { authenticator } from "../services/auth.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticator.logout(request, { redirectTo: "/login" });
  return redirect("/login");
};

export default function Logout() {
  return null;
}
