import { Timestamp, FieldValue } from 'firebase-admin/firestore';

export interface SapTicket {
  id: string;
  date: Date | null; // Correction du type
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
    date: Date | null; // Correction du type pour permettre null
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

// Définir et exporter le type pour les statuts de ticket SAP
export type SapTicketStatus = 'open' | 'closed' | 'pending' | 'archived' | 'rma_request' | 'material_sent';

export type NotificationType =
  | 'ticket_created'
  | 'ticket_closed'
  | 'shipment'
  | 'installation'
  | 'installation_closed';

export type UserRole = 'Admin' | 'Technician' | 'Logistics' | 'Client' | string;

export interface Notification {
  id: string;
  userId?: string;
  type: NotificationType;
  sector?: string[];
  targetRoles?: UserRole[];
  title: string; // Added title property
  message: string;
  metadata?: Record<string, any>;
  createdAt: Timestamp | Date;
  read: boolean;
  link?: string;
}

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
  labelSapClosed?: string; // Added for Gmail config
  labelSapRma?: string; // Added for Gmail config
  labelSapNoResponse?: string; // Added for Gmail config
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
  dateCreation?: Date; // Changed type to Date
  articleNom?: string; // Added articleNom
  trackingLink?: string; // Added trackingLink
}

export type InstallationStatus = 'rendez-vous à prendre' | 'rendez-vous pris' | 'installation terminée';

export interface InstallationFilters { // Exportation ajoutée
  status?: InstallationStatus;
  dateRange?: { start: Date; end: Date };
  commercial?: string;
  technicien?: string;
  ville?: string;
  searchTerm?: string;
}

export interface Installation {
  id: string;
  secteur: 'CHR' | 'HACCP' | 'Tabac' | 'Kezia' | string;
  codeClient: string;
  nom: string;
  ville?: string; // Rendre optionnel
  contact?: string; // Rendre optionnel
  telephone?: string; // Rendre optionnel
  commercial?: string; // Rendre optionnel
  tech?: string; // Rendre optionnel
  status: InstallationStatus;
  dateInstall?: string; // Déjà optionnel, mais vérifier
  commentaire?: string; // Rendre optionnel
  adresse?: string; // Déjà optionnel, mais vérifier
  codePostal?: string; // Déjà optionnel, mais vérifier
  hasCTN?: boolean; // Ajouter la propriété hasCTN (optionnelle car elle n'est pas toujours présente dans les données brutes)
}

export interface InstallationsSnapshot { // Exportation ajoutée
  total: number;
  byStatus: Record<InstallationStatus, number>;
  bySector: Record<string, {
    total: number;
    byStatus: Record<InstallationStatus, number>;
  }>;
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
  timestamp: string;
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

export interface Article { // Exportation ajoutée
  id: string;
  Code: string; // Utiliser le nom de champ correct
  Désignation: string; // Utiliser le nom de champ correct
  imageUrls?: string[];
}

export interface SAPArchive { // Exportation ajoutée
  originalTicketId: string;
  archivedDate: Timestamp;
  closureReason: 'resolved' | 'no-response' | string;
  technicianNotes: string;
  technician: string;
  client: { stringValue: string };
  raisonSociale: { stringValue: string };
  description: { stringValue: string };
  secteur: 'CHR' | 'HACCP' | 'Kezia' | 'Tabac';
  numeroSAP: { stringValue: string };
  mailId?: string;
  documents?: string[];
}
