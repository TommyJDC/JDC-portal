import { Timestamp, FieldValue } from 'firebase-admin/firestore';

export interface SapTicket {
  id: string;
  date: string | null; // Changement déjà effectué
  client?: { stringValue: string };
  raisonSociale?: { stringValue: string };
  description?: { stringValue: string };
  statut?: { stringValue: string };
  secteur: 'CHR' | 'HACCP' | 'Kezia' | 'Tabac';
  demandeSAP?: { stringValue: string };
  numeroSAP?: { stringValue: string };
  deducedSalesperson?: string;
  adresse?: { stringValue: string };
  telephone?: { stringValue: string };
  codeClient?: { stringValue: string };
  priorite?: { stringValue: string };
  origine?: { stringValue: string };
  type?: { stringValue: string };
  descriptionProbleme?: { stringValue: string };
  statutSAP?: string;
  commentaires?: string[];
  summary?: string;
  solution?: string;
  technicianNotes?: string;
  materialDetails?: string;
  mailId: string;
  status: 'open' | 'closed' | 'pending' | 'archived' | 'rma_request' | 'material_sent';
  materialType?: 'RMA' | 'envoi-materiel';
  contactAttempts?: Array<{
    date: string; // Conversion finale en string ISO
    method: 'email' | 'phone';
    success: boolean;
  }>;
  aiSummary?: string;
  gmailLabels?: string[];
  mailFrom?: string;
  mailTo?: string[];
  mailCc?: string[];
  mailSubject?: string;
  mailThreadId?: string;
  mailMessageId?: string;
  mailReferences?: string;
  mailDate?: string;
}

export type NotificationType = 
  | 'ticket_created' 
  | 'ticket_closed' 
  | 'shipment' 
  | 'installation' 
  | 'installation_closed';

export type UserRole = 'Admin' | 'Technician' | 'Logistics' | 'Client' | string; // Ajout de string pour flexibilité

export interface Notification {
  id: string;
  userId?: string; // Rendre optionnel si la notification est globale ou par rôle/secteur
  type: NotificationType;
  sector?: string[]; // Peut être vide si non applicable
  targetRoles?: UserRole[]; // Peut être vide si ciblé par userId
  message: string;
  metadata?: Record<string, any>; // Pour stocker des infos supplémentaires (ticketId, etc.)
  createdAt: Timestamp | Date; // Utiliser Timestamp pour Firestore
  read: boolean;
  link?: string;
}

// Restauration des interfaces critiques
export interface UserProfile {
  uid: string;
  email: string;
  role: 'Admin' | 'Technician' | string;
  secteurs: string[];
  faity?: string;
  displayName: string;
  nom: string;
  createdAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
  googleRefreshToken?: string;
  isGmailProcessor?: boolean;
  gmailAuthorizedScopes?: string[];
  gmailAuthStatus?: 'active' | 'expired' | 'unauthorized';
  phone?: string;
  address?: string;
}

export interface Shipment {
  id: string;
  codeClient: string;
  nomClient: string;
  adresse: string;
  ville: string;
  codePostal: string;
  statutExpedition: 'OUI' | 'NON' | string;
  secteur: string;
  dateCreation?: string; // Conversion en string
}

export interface Installation {
  id: string;
  secteur: 'CHR' | 'HACCP' | 'Tabac' | 'Kezia' | string;
  codeClient: string;
  nom: string;
  status: 'rendez-vous à prendre' | 'rendez-vous pris' | 'installation terminée';
  dateInstall?: string; // Conversion en string
}

export interface GmailProcessingConfig {
  maxEmailsPerRun: number;
  processedLabelName: string;
  refreshInterval: number;
  sectorCollections: Record<string, {
    enabled: boolean;
    labels: string[];
    responsables: string[];
  }>;
}

export interface StatsSnapshot {
  id: string;
  timestamp: string; // Conversion en string
  totalTickets: number;
  activeClients: number;
}

export interface InstallationsDashboardStats {
  haccp: {
    total: number;
    enAttente: number;
    planifiees: number;
    terminees: number;
  };
  chr: {
    total: number;
    enAttente: number;
    planifiees: number;
    terminees: number;
  };
  tabac: {
    total: number;
    enAttente: number;
    planifiees: number;
    terminees: number;
  };
  kezia: {
    total: number;
    enAttente: number;
    planifiees: number;
    terminees: number;
  };
}
