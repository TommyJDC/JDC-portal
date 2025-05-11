import React, { useState } from 'react';
import { Form, useActionData, useNavigation, Link } from '@remix-run/react'; // Ajout de Link
import type { ActionFunctionArgs, SerializeFrom } from '@remix-run/node';
import { json } from '@remix-run/node';
import { createNotification } from '~/services/notifications.service.server';
import type { NotificationType } from '~/types/firestore.types'; // Importer NotificationType
import { FaSpinner, FaBell, FaPaperPlane, FaExclamationTriangle, FaCheckCircle } from 'react-icons/fa'; // Ajout d'icônes
import { Input } from '~/components/ui/Input';
import { Textarea } from '~/components/ui/Textarea';
import { Button } from '~/components/ui/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/Select'; // Importer le composant Select

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
  const type = formData.get('type') as string | null;

  if (!userId || !title || !message) {
    return json({ error: 'Les champs ID Utilisateur, Titre et Message sont requis.' }, { status: 400 });
  }

  const notificationTypeValue = (type || 'info') as NotificationType; // Valeur par défaut 'info' si non fourni

  try {
    const notification = await createNotification({
      userId,
      title,
      message,
      link: link || undefined,
      type: notificationTypeValue,
      // createdAt et isRead sont gérés par le service createNotification
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

const inputBaseClasses = "w-full bg-ui-input border-ui-border text-text-primary focus:border-brand-blue focus:ring-1 focus:ring-brand-blue rounded-md text-sm";
const labelBaseClasses = "block text-xs font-medium text-text-secondary mb-1";
const selectTriggerClasses = inputBaseClasses; // Utiliser les mêmes styles pour la cohérence
const selectContentClasses = "bg-ui-surface border-ui-border text-text-primary";
const selectItemClasses = "hover:bg-ui-hover focus:bg-ui-hover";

export default function AdminNotifications() {
  const actionData = useActionData<SerializeFrom<ActionData>>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';
  const [notificationType, setNotificationType] = useState<NotificationType>('info');

  const notificationTypes: { value: NotificationType; label: string }[] = [
    { value: 'info', label: 'Information' },
    { value: 'success', label: 'Succès' },
    { value: 'warning', label: 'Avertissement' },
    { value: 'error', label: 'Erreur' },
    { value: 'new_ticket', label: 'Nouveau Ticket' },
    { value: 'ticket_update', label: 'Mise à jour Ticket' },
    { value: 'ticket_closed', label: 'Ticket Fermé' },
    { value: 'new_shipment', label: 'Nouvel Envoi' },
    { value: 'installation', label: 'Installation' },
    { value: 'installation_closed', label: 'Installation Fermée' },
  ];

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 bg-ui-surface rounded-lg shadow-md border border-ui-border">
      <h1 className="text-xl font-semibold text-text-primary mb-6 flex items-center">
        <FaBell className="mr-3 text-brand-blue" />
        Créer une Notification Manuelle
      </h1>

      <Form method="post" className="space-y-5">
        <Input label="ID Utilisateur Cible *" name="userId" id="userId" required className={inputBaseClasses} labelClassName={labelBaseClasses} />
        <Input label="Titre *" name="title" id="title" required className={inputBaseClasses} labelClassName={labelBaseClasses} />
        <div>
          <label htmlFor="message" className={labelBaseClasses}>Message *</label>
          <Textarea name="message" id="message" required rows={4} className={`${inputBaseClasses} min-h-[100px]`} />
        </div>
        <Input label="Lien (optionnel)" name="link" id="link" className={inputBaseClasses} labelClassName={labelBaseClasses} />

        <div>
          <label htmlFor="type" className={labelBaseClasses}>Type de Notification</label>
          <Select name="type" value={notificationType} onValueChange={(value) => setNotificationType(value as NotificationType)}>
            <SelectTrigger id="type" className={selectTriggerClasses}>
              <SelectValue placeholder="Sélectionner un type" />
            </SelectTrigger>
            <SelectContent className={selectContentClasses}>
              {notificationTypes.map(nt => (
                <SelectItem key={nt.value} value={nt.value} className={selectItemClasses}>{nt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {actionData?.error && (
          <div className="flex items-start p-3 text-sm rounded-md bg-red-500/10 border border-red-500/30 text-red-300">
            <FaExclamationTriangle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
            <span>{actionData.error}</span>
          </div>
        )}

        {actionData?.success && (
          <div className="flex items-start p-3 text-sm rounded-md bg-green-500/10 border border-green-500/30 text-green-700">
             <FaCheckCircle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
            <span>Notification créée avec succès ! (ID: {actionData.notification?.id})</span>
          </div>
        )}

        <Button type="submit" disabled={isSubmitting} variant="primary" className="w-full bg-brand-blue hover:bg-brand-blue-dark">
          {isSubmitting ? (
            <>
              <FaSpinner className="animate-spin mr-2" />
              Création en cours...
            </>
          ) : (
            <>
              <FaPaperPlane className="mr-2" />
              Créer la Notification
            </>
          )}
        </Button>
      </Form>
    </div>
  );
}
