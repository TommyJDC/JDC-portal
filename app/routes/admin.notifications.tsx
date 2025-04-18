import React, { useState } from 'react';
import { Form, useActionData, useNavigation } from '@remix-run/react';
import type { ActionFunctionArgs, SerializeFrom } from '@remix-run/node';
import { json } from '@remix-run/node';
import { createNotification } from '~/services/notifications.service.server';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

type ActionData = {
  error?: string;
  success?: boolean;
  notification?: Awaited<ReturnType<typeof createNotification>>;
};

export async function action({ request }: ActionFunctionArgs): Promise<Response> {
  const formData = await request.formData();
  const userId = formData.get('userId') as string;
  const title = formData.get('title') as string;
  const message = formData.get('message') as string;
  const link = formData.get('link') as string;
  const type = formData.get('type') as string;

  if (!userId || !title || !message) {
    return json({ error: 'Tous les champs requis doivent être remplis' }, { status: 400 });
  }

  try {
    const notification = await createNotification({
      userId,
      title,
      message,
      link: link || undefined,
      type: type || 'system'
    });

    if (notification) {
      return json({ success: true, notification });
    }
    return json({ error: 'Erreur lors de la création de la notification' }, { status: 500 });
  } catch (error) {
    console.error('Error creating notification:', error);
    return json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export default function AdminNotifications() {
  const actionData = useActionData<SerializeFrom<ActionData>>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';
  const [notificationType, setNotificationType] = useState('system');

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Créer une notification</h1>

      <Form method="post" className="space-y-4">
        <div>
          <label htmlFor="userId" className="block text-sm font-medium text-jdc-gray-300 mb-1">
            ID Utilisateur *
          </label>
          <input
            type="text"
            name="userId"
            id="userId"
            required
            className="w-full px-3 py-2 bg-jdc-gray-800 border border-jdc-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-jdc-yellow focus:border-transparent"
          />
        </div>

        <div>
          <label htmlFor="title" className="block text-sm font-medium text-jdc-gray-300 mb-1">
            Titre *
          </label>
          <input
            type="text"
            name="title"
            id="title"
            required
            className="w-full px-3 py-2 bg-jdc-gray-800 border border-jdc-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-jdc-yellow focus:border-transparent"
          />
        </div>

        <div>
          <label htmlFor="message" className="block text-sm font-medium text-jdc-gray-300 mb-1">
            Message *
          </label>
          <textarea
            name="message"
            id="message"
            required
            rows={3}
            className="w-full px-3 py-2 bg-jdc-gray-800 border border-jdc-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-jdc-yellow focus:border-transparent"
          />
        </div>

        <div>
          <label htmlFor="link" className="block text-sm font-medium text-jdc-gray-300 mb-1">
            Lien (optionnel)
          </label>
          <input
            type="text"
            name="link"
            id="link"
            className="w-full px-3 py-2 bg-jdc-gray-800 border border-jdc-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-jdc-yellow focus:border-transparent"
          />
        </div>

        <div>
          <label htmlFor="type" className="block text-sm font-medium text-jdc-gray-300 mb-1">
            Type
          </label>
          <select
            name="type"
            id="type"
            value={notificationType}
            onChange={(e) => setNotificationType(e.target.value)}
            className="w-full px-3 py-2 bg-jdc-gray-800 border border-jdc-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-jdc-yellow focus:border-transparent"
          >
            <option value="system">Système</option>
            <option value="ticket">Ticket</option>
            <option value="shipment">Envoi</option>
          </select>
        </div>

        {actionData?.error && (
          <div className="text-red-500 text-sm">{actionData.error}</div>
        )}

        {actionData?.success && (
          <div className="text-green-500 text-sm">Notification créée avec succès !</div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full px-4 py-2 bg-jdc-yellow hover:bg-jdc-yellow-light text-black font-medium rounded-md transition-colors duration-200 flex items-center justify-center"
        >
          {isSubmitting ? (
            <>
              <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-2" />
              Création en cours...
            </>
          ) : (
            'Créer la notification'
          )}
        </button>
      </Form>
    </div>
  );
}
