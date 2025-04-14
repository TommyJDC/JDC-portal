import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => {
  return [{ title: "Clients | JDC Dashboard" }];
};

export default function Clients() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">Gestion des Clients</h1>
      <p className="text-jdc-gray-400 mt-2">Page en construction.</p>
      {/* Add client management table/components here */}
    </div>
  );
}
