import { Form, useActionData, useNavigation } from '@remix-run/react';
import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node';
import { FaTicketAlt, FaSpinner, FaExclamationTriangle, FaCheckCircle } from 'react-icons/fa';
import { Button } from '~/components/ui/Button';
import { useState } from 'react';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAllUserProfilesSdk } from '~/services/firestore.service.server';
import { generateAISummary } from '~/services/ai.service.server';
import { getGoogleAuthClient } from '~/services/google.server';
import { sendSAPResponseEmail } from '~/services/gmail.service.server';
import type { UserSessionData } from '~/services/session.server';
import type { MetaFunction } from '@remix-run/node';

export const meta: MetaFunction = () => {
  return [
    { title: "Création de Ticket SAP | JDC Portal" },
    { charSet: "utf-8" },
    { name: "viewport", content: "width=device-width,initial-scale=1" }
  ];
};

interface TicketSAPFormData {
  raisonSociale: string;
  codeClient: string;
  telephone: string;
  secteur: 'CHR' | 'Tabac' | 'HACCP' | 'Kezia';
  type: 'incident' | 'demande' | 'question';
  priorite: 'basse' | 'moyenne' | 'haute' | 'critique';
  description: string;
}

// Fonction d'initialisation de Firebase Admin
function initializeFirebaseAdmin() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }
}

export async function loader({ request }: LoaderFunctionArgs) {
  // Initialiser Firebase Admin
  initializeFirebaseAdmin();
  
  return json({});
}

export async function action({ request }: ActionFunctionArgs) {
  // Initialiser Firebase Admin
  initializeFirebaseAdmin();

  const formData = await request.formData();
  const ticketData: TicketSAPFormData = {
    raisonSociale: formData.get("raisonSociale") as string,
    codeClient: formData.get("codeClient") as string,
    telephone: formData.get("telephone") as string,
    secteur: formData.get("secteur") as "CHR" | "Tabac" | "HACCP" | "Kezia",
    type: formData.get("type") as "incident" | "demande" | "question",
    priorite: formData.get("priorite") as "basse" | "moyenne" | "haute" | "critique",
    description: formData.get("description") as string,
  };

  try {
    const db = getFirestore();
    const collectionName = `sap-${ticketData.secteur?.toLowerCase()}`;

    // Générer un numéro SAP unique (timestamp + 4 chiffres aléatoires)
    const numeroSAP = `${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`;
    const secret = Math.random().toString(36).substring(2, 15);

    // Récupérer tous les utilisateurs
    const allUsers = await getAllUserProfilesSdk();
    
    // Filtrer les utilisateurs qui ont le secteur sélectionné
    const usersToNotify = allUsers.filter(user => 
      user.secteurs?.includes(ticketData.secteur || '')
    );

    // Liste des destinataires principaux (utilisateurs du secteur)
    const recipientEmails = usersToNotify.map(user => user.email);
    
    // Email d'Alexis en CC
    const alexisEmail = 'alexis.lhersonneau@jdc.fr';

    // Créer le ticket dans Firestore
    const ticketRef = await db.collection(collectionName).add({
      ...ticketData,
      numeroSAP,
      secret,
      date: new Date().toLocaleDateString('fr-FR'),
      statut: 'nouveau',
      status: 'nouveau',
      createdAt: new Date(),
      // Ajouter les informations d'email
      mailTo: recipientEmails,
      mailCc: [alexisEmail],
      mailFrom: 'system@jdc.fr', // Email système par défaut
      mailMessageId: `ticket-${numeroSAP}@jdc.fr`, // ID unique pour le message
      mailThreadId: `thread-${numeroSAP}@jdc.fr`, // ID unique pour le thread
      mailReferences: `ticket-${numeroSAP}@jdc.fr` // Référence initiale
    });

    // Créer une session système pour l'authentification Google
    const systemSession: UserSessionData = {
      userId: 'system',
      email: 'system@jdc.fr',
      displayName: 'System',
      role: 'Admin',
      secteurs: ['CHR', 'Tabac', 'HACCP', 'Kezia'],
      googleRefreshToken: process.env.GOOGLE_REFRESH_TOKEN || ''
    };

    // Générer le contenu de l'email avec l'IA
    const emailContent = await generateAISummary(
      await getGoogleAuthClient(systemSession),
      {
        id: ticketRef.id,
        numeroSAP: numeroSAP,
        raisonSociale: ticketData.raisonSociale,
        description: ticketData.description,
        descriptionProbleme: ticketData.description,
        codeClient: ticketData.codeClient,
        telephone: ticketData.telephone,
        type: ticketData.type,
        priorite: ticketData.priorite,
        secteur: ticketData.secteur,
        statut: 'nouveau',
        date: new Date(),
        status: 'nouveau',
        client: ticketData.raisonSociale,
        mailTo: recipientEmails,
        mailCc: [alexisEmail],
        mailFrom: 'system@jdc.fr',
        mailMessageId: `ticket-${numeroSAP}@jdc.fr`,
        mailThreadId: `thread-${numeroSAP}@jdc.fr`,
        mailReferences: `ticket-${numeroSAP}@jdc.fr`
      },
      undefined,
      'NO_RESPONSE'
    );

    // Envoyer l'email à tous les destinataires
    if (emailContent) {
      await sendSAPResponseEmail(
        await getGoogleAuthClient(systemSession),
        {
          id: ticketRef.id,
          numeroSAP: numeroSAP,
          raisonSociale: ticketData.raisonSociale,
          description: ticketData.description,
          descriptionProbleme: ticketData.description,
          codeClient: ticketData.codeClient,
          telephone: ticketData.telephone,
          type: ticketData.type,
          priorite: ticketData.priorite,
          secteur: ticketData.secteur,
          statut: 'nouveau',
          date: new Date(),
          status: 'nouveau',
          client: ticketData.raisonSociale,
          mailTo: recipientEmails,
          mailCc: [alexisEmail],
          mailFrom: 'system@jdc.fr',
          mailMessageId: `ticket-${numeroSAP}@jdc.fr`,
          mailThreadId: `thread-${numeroSAP}@jdc.fr`,
          mailReferences: `ticket-${numeroSAP}@jdc.fr`
        } as any,
        `[NOUVEAU TICKET SAP] ${ticketData.raisonSociale} - ${numeroSAP}`,
        emailContent
      );
    }

    return json({
      success: true,
      message: `Ticket créé avec succès. Numéro SAP: ${numeroSAP}`,
      numeroSAP,
      secret
    });
  } catch (error) {
    console.error("Erreur lors de la création du ticket:", error);
    return json({
      success: false,
      error: "Erreur lors de la création du ticket"
    }, { status: 500 });
  }
}

export default function TicketsSAPPage() {
  const actionData = useActionData<{ success?: boolean; message?: string; error?: string; ticketId?: string; numeroSAP?: string; secret?: string }>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  const [selectedType, setSelectedType] = useState<string>('incident');
  const secteurs = ['CHR', 'Tabac', 'HACCP', 'Kezia'];

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-8">
      <h1 className="text-2xl font-semibold text-text-primary mb-6 flex items-center">
        <FaTicketAlt className="mr-3 text-brand-blue" />
        Création de Ticket SAP
      </h1>

      <Form method="post" className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Informations client */}
          <div className="space-y-4">
            <div>
              <label htmlFor="raisonSociale" className="block text-sm font-medium text-text-secondary mb-1">
                Raison Sociale *
              </label>
              <input
                type="text"
                id="raisonSociale"
                name="raisonSociale"
                required
                className="w-full px-3 py-2 bg-ui-background border border-ui-border rounded-md focus:outline-none focus:ring-2 focus:ring-brand-blue"
                placeholder="Raison sociale du client"
              />
            </div>

            <div>
              <label htmlFor="codeClient" className="block text-sm font-medium text-text-secondary mb-1">
                Code Client *
              </label>
              <input
                type="text"
                id="codeClient"
                name="codeClient"
                required
                className="w-full px-3 py-2 bg-ui-background border border-ui-border rounded-md focus:outline-none focus:ring-2 focus:ring-brand-blue"
                placeholder="Code client SAP"
              />
            </div>

            <div>
              <label htmlFor="telephone" className="block text-sm font-medium text-text-secondary mb-1">
                Téléphone *
              </label>
              <input
                type="tel"
                id="telephone"
                name="telephone"
                required
                className="w-full px-3 py-2 bg-ui-background border border-ui-border rounded-md focus:outline-none focus:ring-2 focus:ring-brand-blue"
                placeholder="Numéro de téléphone"
              />
            </div>

            <div>
              <label htmlFor="secteur" className="block text-sm font-medium text-text-secondary mb-1">
                Secteur *
              </label>
              <select
                id="secteur"
                name="secteur"
                required
                className="w-full px-3 py-2 bg-ui-background border border-ui-border rounded-md focus:outline-none focus:ring-2 focus:ring-brand-blue"
              >
                <option value="">Sélectionnez un secteur</option>
                {secteurs.map((secteur) => (
                  <option key={secteur} value={secteur}>
                    {secteur}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Type et Priorité */}
          <div className="space-y-4">
            <div>
              <label htmlFor="type" className="block text-sm font-medium text-text-secondary mb-1">
                Type de ticket *
              </label>
              <select
                id="type"
                name="type"
                required
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full px-3 py-2 bg-ui-background border border-ui-border rounded-md focus:outline-none focus:ring-2 focus:ring-brand-blue"
              >
                <option value="incident">Incident</option>
                <option value="demande">Demande</option>
                <option value="question">Question</option>
              </select>
            </div>

            <div>
              <label htmlFor="priorite" className="block text-sm font-medium text-text-secondary mb-1">
                Priorité *
              </label>
              <select
                id="priorite"
                name="priorite"
                required
                className="w-full px-3 py-2 bg-ui-background border border-ui-border rounded-md focus:outline-none focus:ring-2 focus:ring-brand-blue"
              >
                <option value="basse">Basse</option>
                <option value="moyenne">Moyenne</option>
                <option value="haute">Haute</option>
                <option value="critique">Critique</option>
              </select>
            </div>
          </div>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-text-secondary mb-1">
            Description détaillée *
          </label>
          <textarea
            id="description"
            name="description"
            required
            rows={6}
            className="w-full px-3 py-2 bg-ui-background border border-ui-border rounded-md focus:outline-none focus:ring-2 focus:ring-brand-blue"
            placeholder="Décrivez en détail votre demande..."
          />
        </div>

        {/* Bouton de soumission */}
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={isSubmitting}
            variant="primary"
            className="w-full sm:w-auto bg-brand-blue hover:bg-brand-blue-dark"
          >
            {isSubmitting ? (
              <>
                <FaSpinner className="animate-spin mr-2" />
                Création en cours...
              </>
            ) : (
              <>
                <FaTicketAlt className="mr-2" />
                Créer le ticket
              </>
            )}
          </Button>
        </div>
      </Form>

      {/* Messages de retour */}
      {actionData?.error && (
        <div className="flex items-start p-3 text-sm rounded-md bg-red-500/10 border border-red-500/30 text-red-300">
          <FaExclamationTriangle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
          <span>{actionData.error}</span>
        </div>
      )}

      {actionData?.success && (
        <div className="flex flex-col space-y-4 p-4 rounded-md bg-green-500/10 border border-green-500/30 text-green-300">
          <div className="flex items-start">
            <FaCheckCircle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
            <span>{actionData.message}</span>
          </div>
          <div className="mt-2 space-y-2">
            <p className="text-sm">
              <span className="font-semibold">Numéro SAP :</span> {actionData.numeroSAP}
            </p>
            <p className="text-sm">
              <span className="font-semibold">Code secret :</span> {actionData.secret}
            </p>
          </div>
        </div>
      )}
    </div>
  );
} 