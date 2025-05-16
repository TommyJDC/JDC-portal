import type { DataFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { syncAllSectors } from '~/services/sync-installations.server';

export async function action({ request }: DataFunctionArgs) {
  const result = await syncAllSectors();
  return json(result);
}

export async function loader({ request }: DataFunctionArgs) {
  const result = await syncAllSectors();
  return json(result);
}
