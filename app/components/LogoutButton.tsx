import { Form } from "@remix-run/react";

export function LogoutButton() {
  return (
    <Form action="/logout" method="post">
      <button
        type="submit"
        className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
      >
        Déconnexion
      </button>
    </Form>
  );
}
