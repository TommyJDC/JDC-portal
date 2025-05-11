export interface UserProfile {
  uid: string;
  email: string;
  role: string;
  secteurs: string[];
  displayName: string;
  nom: string;
  phone: string;
  address?: string;
  blockchainAddress?: string;
  jobTitle?: string;
  department?: string;
  googleRefreshToken?: string;
  isGmailProcessor?: boolean;
  gmailAuthorizedScopes?: string[];
  gmailAuthStatus?: string;
  labelSapClosed?: string;
  labelSapNoResponse?: string;
  labelSapRma?: string;
  encryptedWallet?: string;
  createdAt?: Date; // Réintroduit
  updatedAt?: Date; // Réintroduit
}

export interface Installation {
  id: string;
  secteur: string;
  codeClient: string;
  nom: string;
  ville: string;
  contact?: string;
  telephone?: string;
  commercial?: string;
  tech?: string;
  status: 'rendez-vous à prendre' | 'rendez-vous pris' | 'installation terminée' | string;
  commentaire?: string;
  dateInstall: Date | string;
  adresse?: string;
  codePostal?: string;
  hasCTN?: boolean;
}

export type InstallationStatus = 'rendez-vous à prendre' | 'rendez-vous pris' | 'installation terminée';

export interface InstallationsSnapshot {
  total: number;
  byStatus: Record<InstallationStatus, number>;
  bySector: Record<string, {
    total: number;
    byStatus: Record<InstallationStatus, number>;
  }>;
}

export interface SapTicket {
  id: string;
  secteur: string;
  numeroSAP: string;
  client: string | { stringValue: string };
  raisonSociale: string | { stringValue: string };
  description: string | { stringValue: string };
  date: Date | null;
  status: string | { stringValue: string };
  statut: string | { stringValue: string };
  priority?: string | { stringValue: string };
  assignedTo?: string | { stringValue: string };
  resolution?: string | { stringValue: string };
  telephone?: string | { stringValue: string };
  adresse?: string | { stringValue: string };
  codeClient?: string | { stringValue: string };
  deducedSalesperson?: string | { stringValue: string };
  demandeSAP?: string | { stringValue: string };
  descriptionProbleme?: string | { stringValue: string };
  mailId?: string; // Ajouté pour la cohérence avec SAPArchive et l'utilisation dans firestore.service
  contactAttempts?: Array<{
    date: Date | null;
    notes: string;
    outcome: string;
  }>;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  userId: string;
  isRead: boolean;
  createdAt: Date;
  link?: string;
  targetRoles?: UserRole[]; // Ajouté pour le ciblage par rôle
  sector?: string[]; // Ajouté pour le ciblage par secteur
  metadata?: Record<string, any>; // Pour des données additionnelles spécifiques au type
  sourceId?: string; // ID de l'entité source (ticket, installation, etc.)
}

// Définition des types de notification
export type NotificationType = 
  | 'installation' 
  | 'installation_closed' 
  | 'new_ticket' 
  | 'ticket_update' // Pour les mises à jour de tickets
  | 'ticket_closed' // Pour les clôtures de tickets
  | 'new_shipment'  // Pour les nouveaux envois CTN
  | 'info'            // Notification générale
  | 'warning'
  | 'error'
  | 'success';

// Définition des rôles utilisateur
export type UserRole = 'Admin' | 'Technician' | 'Logistics' | 'Client' | 'Viewer' | string; // string pour flexibilité

export interface SAPArchive {
  originalTicketId: string;
  archivedDate: number;
  closureReason: 'resolved' | 'no-response';
  technicianNotes: string;
  technician: string;
  client: string | { stringValue: string };
  raisonSociale: string | { stringValue: string };
  description: string | { stringValue: string };
  secteur: 'CHR' | 'HACCP' | 'Kezia' | 'Tabac';
  numeroSAP: string | { stringValue: string };
  mailId?: string;
  documents: string[];
}

export interface Article {
  id?: string; // identifiant unique Firestore
  code: string;
  designation: string;
  type: string;
  category: string;
  images?: string[];
  // secret?: string; // décommenter si utilisé côté Firestore
}

export interface Shipment {
  id?: string; // Identifiant de l'envoi (peut-être le numéro de BT ou un ID Firestore)
  codeClient?: string;
  nomClient?: string; // Nom du client
  client?: string; // Gardé pour rétrocompatibilité si certaines données l'utilisent encore
  secteur?: string;
  articleNom?: string; // Nom de l'article principal
  produits?: string[]; // Peut-être une liste si plusieurs produits, ou utiliser articleNom
  numeroCTN?: string; // Numéro de suivi CTN (TNT)
  bt?: string; // Bon de Transport, pourrait être le même que numeroCTN ou id
  statutExpedition?: string; // Statut de l'expédition (ex: "OUI", "NON")
  statut?: string; // Gardé pour rétrocompatibilité
  trackingLink?: string; // Lien de suivi direct
  date?: Date | string; // Date de création ou d'événement principal de l'envoi
  dateLivraison?: Date | string; // Date de livraison prévue/réelle
  createdAt?: Date; // Date de création de l'enregistrement Firestore
  updatedAt?: Date;
  secret?: string; // Si utilisé
}

export interface StatsSnapshot {
  id?: string;
  timestamp: Date;
  clientCount: number;
  clientEvolution: number;
  installations: any; // Define a more specific type if possible
  ticketCounts: Record<string, number>;
}

// Ajout des types pour les statistiques d'installations du dashboard
interface SectorInstallationsStats {
  total: number;
  enAttente: number; // correspond à 'rendez-vous à prendre'
  planifiees: number; // correspond à 'rendez-vous pris'
  terminees: number; // correspond à 'installation terminée'
}

export interface InstallationsDashboardStats {
  haccp: SectorInstallationsStats;
  chr: SectorInstallationsStats;
  tabac: SectorInstallationsStats;
  kezia: SectorInstallationsStats;
}

export interface InstallationFilters {
  status?: InstallationStatus;
  dateRange?: { start: Date; end: Date };
  commercial?: string;
  technicien?: string;
  ville?: string;
  searchTerm?: string;
}

// Configuration pour le traitement Gmail
export interface SectorGmailConfig { // Ajout de export
  enabled: boolean;
  labels: string[];       // Labels Gmail à surveiller pour ce secteur
  responsables: string[]; // UID des utilisateurs responsables du traitement pour ce secteur
}

export interface GmailProcessingConfig {
  maxEmailsPerRun: number;        // Nombre max d'emails à traiter par exécution
  processedLabelName: string;   // Nom du label Gmail à appliquer après traitement
  refreshInterval: number;        // Intervalle de rafraîchissement pour la tâche planifiée (en minutes)
  sectorCollections: {
    kezia: SectorGmailConfig;
    haccp: SectorGmailConfig;
    chr: SectorGmailConfig;
    tabac: SectorGmailConfig;
  };
  // Champs pour les templates d'IA (utilisés dans gmail-config.tsx)
  aiClosureTemplate?: string;
  aiRmaTemplate?: string;
  aiNoResponseTemplate?: string;
}
