import { Timestamp, FieldValue } from 'firebase-admin/firestore'; // Import necessary types for firebase-admin compatibility

/**
 * Represents a notification in the system
 */
export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  timestamp: Date | Timestamp;
  read: boolean;
  link?: string;
  type?: 'ticket' | 'shipment' | 'system' | string;
  sourceId?: string; // ID of the related item (ticket, shipment, etc.)
}

/**
 * Represents the structure of user profile data stored in Firestore.
 */
export interface UserProfile {
  uid: string;
  email: string;
  role: 'Admin' | 'Technician' | string;
  secteurs: string[]; // Liste des secteurs de l'utilisateur (Kezia, HACCP, CHR, Tabac)
  faity?: string;
  secteur?: string;
  displayName: string;
  nom: string;
  password?: string; // Rendre le mot de passe optionnel
  createdAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
  // Gmail processing fields
  googleRefreshToken?: string;
  isGmailProcessor?: boolean;
  gmailAuthorizedScopes?: string[];
  gmailAuthStatus?: 'active' | 'expired' | 'unauthorized';
  phone?: string;
  address?: string;
  avatarUrl?: string;
  jobTitle?: string;
  department?: 'technique' | 'commercial' | 'admin';
  // User-specific Gmail label configuration
  labelSapClosed?: string; // Gmail label name for closed tickets
  labelSapRma?: string; // Gmail label name for RMA/material requests
  labelSapNoResponse?: string; // Gmail label name for no response cases
}

/**
 * Configuration for Gmail processing stored in settings collection
 */
export interface GmailProcessingConfig {
  maxEmailsPerRun: number;
  processedLabelName: string; // Label to add to processed emails
  refreshInterval: number; // Délai en minutes entre chaque vérification
  sectorCollections: {
    kezia: {
      enabled: boolean;
      labels: string[];
      responsables: string[];
    };
    haccp: {
      enabled: boolean;
      labels: string[];
      responsables: string[];
    };
    chr: {
      enabled: boolean;
      labels: string[];
      responsables: string[];
    };
    tabac: {
      enabled: boolean;
      labels: string[];
      responsables: string[];
    };
  };
}

/**
 * Represents a SAP ticket document from Firestore sector collections (CHR, HACCP, etc.).
 * Ensure these fields match your actual Firestore data structure.
 */
export interface SapTicket {
  id: string;
  date: Date | Timestamp | null;
  client?: { stringValue: string };
  raisonSociale?: { stringValue: string };
  description?: { stringValue: string }; // Made properly optional
  statut?: { stringValue: string }; // Also making status properly optional for consistency
  secteur: 'CHR' | 'HACCP' | 'Kezia' | 'Tabac'; // Corrected type to strict union
  demandeSAP?: { stringValue: string } | undefined; // Optional field used for automatic status correction

  // Fields inspired by TicketList reference
  numeroSAP?: { stringValue: string } | undefined; // Optional: SAP ticket number
  deducedSalesperson?: string; // Optional: Salesperson name
  adresse?: { stringValue: string } | undefined; // Optional: Client address associated with the ticket
  telephone?: { stringValue: string } | undefined; // Optional: Phone number(s), potentially comma-separated

  // Add other relevant fields from your Firestore documents:
  codeClient?: { stringValue: string } | undefined; // Optional: If you have a separate client code
  priorite?: { stringValue: string } | undefined; // Example: 'Haute', 'Moyenne', 'Basse'
  // technicien?: string; // Example: Assigned technician's name or ID
  // resolution?: string; // Example: Details of the resolution
  origine?: { stringValue: string } | undefined; // Added origine based on usage
  type?: { stringValue: string } | undefined; // Added type based on usage

  // Fields for TicketSAPDetails component
  descriptionProbleme?: { stringValue: string } | undefined; // Main problem description (might overlap with 'description')
  statutSAP?: string; // Specific status used in the details modal (might overlap with 'statut')
  commentaires?: string[]; // Array of comments
  summary?: string; // AI Generated Summary
  solution?: string; // AI Generated Solution
  technicianNotes?: string; // Added technician notes field
  materialDetails?: string; // Added material details field
  // ... other ticket properties

  // New fields for automatic response logic
  mailId: string; // Gmail message ID for threading
  status: 'open' | 'closed' | 'pending' | 'archived' | 'rma_request' | 'material_sent'; // Added new statuses
  materialType?: 'RMA' | 'envoi-materiel'; // Type for RMA/material requests
  contactAttempts?: Array<{ // History of contact attempts
    date: Date | Timestamp | { seconds: number; nanoseconds: number } | string; // Added flexibility for deserialized dates
    method: 'email' | 'phone';
    success: boolean;
  }>;
  aiSummary?: string; // AI Generated summary for email
  gmailLabels?: string[]; // Labels applied in Gmail

  // Champs pour l'email et le threading
  mailFrom?: string; // Adresse email de l'expéditeur original
  mailTo?: string[]; // Liste des destinataires originaux
  mailCc?: string[]; // Liste des destinataires en copie
  mailSubject?: string; // Sujet original du mail
  mailThreadId?: string; // ID du thread Gmail
  mailMessageId?: string; // Message-ID pour le threading RFC822
  mailReferences?: string; // Chaîne de références pour le threading
  mailDate?: Date; // Date du mail original
}

/**
 * Represents an archived SAP ticket document.
 */
/**
 * Représente un ticket SAP archivé avec toutes les métadonnées nécessaires
 */
export interface SAPArchive {
  originalTicketId: string;                   // ID original du ticket
  archivedDate: Date | Timestamp;             // Date/heure d'archivage
  closureReason: 'resolved' | 'no-response';  // Raison de la clôture
  technicianNotes: string;                    // Notes techniques obligatoires
  technician: string;                         // Nom du technicien responsable
  client: { stringValue: string };            // Code client formaté
  raisonSociale: { stringValue: string };     // Nom du client
  description: { stringValue: string };       // Description complète
  secteur: 'CHR' | 'HACCP' | 'Kezia' | 'Tabac'; // Secteur d'origine
  numeroSAP: { stringValue: string };         // Numéro SAP complet
  mailId: string;                             // ID du thread Gmail associé
  documents?: string[];                       // URLs des documents joints
}

/**
 * Represents a Shipment document from the 'Envoi' collection in Firestore.
 */
export interface Shipment {
  id: string; // Document ID
  codeClient: string; // Client code
  nomClient: string; // Client name
  adresse: string;
  ville: string;
  codePostal: string;
  statutExpedition: 'OUI' | 'NON' | string; // Shipment status
  secteur: string; // Sector associated with the shipment
  dateCreation?: Date | Timestamp; // Optional: Creation date
  latitude?: number; // For map display
  longitude?: number; // For map display
  articleNom?: string; // Optional: Name of the article being shipped
  trackingLink?: string; // Optional: Link for tracking
  // ... other shipment properties
}

/**
 * Represents a snapshot of statistics stored in Firestore (e.g., in 'dailyStatsSnapshots').
 * Field names should match those used in getLatestStatsSnapshotsSdk mapping.
 */
export interface StatsSnapshot {
  id: string; // Document ID (e.g., date string 'YYYY-MM-DD')
  timestamp: Date | Timestamp; // When the snapshot was taken
  totalTickets: number;      // Matches Firestore field 'totalTickets'
  activeShipments: number;   // Matches Firestore field 'activeShipments' (now unused for dashboard evolution)
  activeClients: number;     // Matches Firestore field 'activeClients' (distinct client count from 'Envoi')
  // Add other stats fields as needed, ensuring names match Firestore document fields
}

/**
 * Represents a geocoding cache entry in Firestore.
 * Document ID is the normalized address string.
 */
export interface GeocodeCacheEntry {
  latitude: number;
  longitude: number;
  timestamp: FieldValue | Timestamp; // Use FieldValue for serverTimestamp on write
}

/**
 * Represents an Article document from the 'articles' collection in Firestore.
 * Fields based on the search function in firestore.service.ts.
 */
export interface Article {
  id: string; // Document ID from Firestore
  Code: string; // Article code (exact match search)
  Désignation: string; // Article name/designation (stored in uppercase, prefix search)
  imageUrls?: string[]; // Optional: Array of Cloud Storage image URLs
  collectionSource?: string; // Optional: Source collection if applicable (e.g., 'CHR', 'HACCP')
  // Add any other relevant fields from your 'articles' documents
  // e.g., prix?: number; stock?: number; fournisseur?: string;
}

// --- Dashboard Specific Types ---

/**
 * Data structure for the dashboard loader (currently minimal).
 */
export interface DashboardLoaderData {
  // Add any data loaded server-side if needed in the future
}

/**
 * Represents the authenticated user object structure, potentially from Firebase Auth.
 * Adjust based on your actual auth provider's user object.
 */
export interface AppUser {
  uid: string;
  email: string | null; // Make email strictly string or null
  displayName: string | null; // Make displayName strictly string or null
// Add other relevant user properties like photoURL, emailVerified, etc.
}


export type InstallationStatus = 'rendez-vous à prendre' | 'rendez-vous pris' | 'installation terminée';

export interface InstallationFilters {
  status?: InstallationStatus;
  secteur?: string;
  dateRange?: {
    start: Date | Timestamp;
    end: Date | Timestamp;
  };
  commercial?: string;
  technicien?: string;
  ville?: string;
  searchTerm?: string;
}

/**
 * Represents an Installation document in Firestore.
 * Data sourced initially from spreadsheets, then managed via the app.
 */
export interface InstallationStats {
  total: number;
  enAttente: number;
  planifiees: number;
  terminees: number;
}

export interface InstallationsDashboardStats {
  haccp: InstallationStats;
  chr: InstallationStats;
  tabac: InstallationStats;
  kezia: InstallationStats;
}

export interface InstallationsSnapshot {
  total: number;
  byStatus: {
    'rendez-vous à prendre': number;
    'rendez-vous pris': number; 
    'installation terminée': number;
  };
  bySector: Record<string, {
    total: number;
    byStatus: {
      'rendez-vous à prendre': number;
      'rendez-vous pris': number;
      'installation terminée': number;
    };
  }>;
}

export interface Installation {
  id: string; // Firestore document ID
  secteur: 'CHR' | 'HACCP' | 'Tabac' | 'Kezia' | string; // Source sector

  // Fields from spreadsheet/InstallationTile and COLUMN_MAPPINGS
  dateCdeMateriel?: string | Timestamp | Date | { seconds: number; nanoseconds: number } | null;
  ca?: string; // Assuming 'ca' might exist, keep it optional
  codeClient: string; // Likely used as a key identifier
  nom: string;
  ville?: string;
  contact?: string;
  telephone?: string;
  commercial?: string;
  configCaisse?: string;
  offreTpe?: string;
  cdc?: string; // Cahier des charges?
  dossier?: string; // Folder/reference?
  tech?: string; // Assigned technician
  dateInstall?: string | Timestamp | Date | { seconds: number; nanoseconds: number } | null;
  commentaire?: string;
  
  // Fields from COLUMN_MAPPINGS (making them optional as they vary by sector)
  dateSignatureCde?: string | Timestamp | Date | { seconds: number; nanoseconds: number } | null; // HACCP, Tabac
  materielPreParametrage?: string; // HACCP
  materielLivre?: string; // CHR, HACCP
  numeroColis?: string; // HACCP
  commentaireInstall?: string; // HACCP
  identifiantMotDePasse?: string; // HACCP
  numerosSondes?: string; // HACCP
  coordonneesTel?: string; // Tabac (used for telephone in Tabac)
  materielBalance?: string; // Tabac
  typeInstall?: string; // Tabac
  commentaireEtatMateriel?: string; // Tabac
  colonne1?: string; // Kezia (assuming this is a data field)
  personneContact?: string; // Kezia
  materielEnvoye?: string; // Kezia
  confirmationReception?: string; // Kezia
  heure?: string; // CHR
  commentaireTech?: string; // CHR
  commentaireEnvoiBT?: string; // CHR
  techSecu?: string; // CHR
  techAffecte?: string; // CHR
  integrationJalia?: string; // CHR


  // New status field
  status: InstallationStatus;

  // Timestamps
  createdAt?: Timestamp | Date | { seconds: number; nanoseconds: number }; // Make optional if not always present
  updatedAt?: Timestamp | Date | { seconds: number; nanoseconds: number }; // Make optional if not always present

  // Optional: Link back to spreadsheet row if needed, e.g., using row index or a unique ID from the sheet
  // spreadsheetRowIndex?: number;
}
