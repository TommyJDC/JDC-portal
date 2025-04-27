import type { ActionFunctionArgs } from "@remix-run/node";
import { triggerScheduledTasks } from "~/services/scheduledTasks.server";

export async function action({ request }: ActionFunctionArgs) {
  // Vous pouvez ajouter une vérification ici pour sécuriser ce point de terminaison,
  // par exemple, vérifier un en-tête secret partagé avec Vercel Cron Jobs.
  // if (request.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
  //   return new Response("Unauthorized", { status: 401 });
  // }

  console.log("[scheduled-tasks] Déclenchement des tâches planifiées via Vercel Cron Job.");
  await triggerScheduledTasks();

  return new Response("Scheduled tasks triggered", { status: 200 });
}

// Si vous avez besoin d'une méthode GET pour tester manuellement, vous pouvez l'ajouter ici
// export async function loader() {
//   console.log("[scheduled-tasks] Déclenchement des tâches planifiées via requête GET.");
//   await triggerScheduledTasks();
//   return new Response("Scheduled tasks triggered (GET)", { status: 200 });
// }
