import { Timestamp, FieldValue } from 'firebase/firestore'; // Import necessary types

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
  password: string;
  createdAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
  // Gmail processing fields
  googleRefreshToken?: string;
  isGmailProcessor?: boolean;
  gmailAuthorizedScopes?: string[];
  gmailAuthStatus?: 'active' | 'expired' | 'unauthorized';
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
    };
    haccp: {
      enabled: boolean;
      labels: string[];
    };
    chr: {
      enabled: boolean;
      labels: string[];
    };
    tabac: {
      enabled: boolean;
      labels: string[];
    };
  };
}

/**
 * Represents a SAP ticket document from Firestore sector collections (CHR, HACCP, etc.).
 * Ensure these fields match your actual Firestore data structure.
 */
export interface SapTicket {
  id: string; // Document ID from Firestore
  // Allow null for date to handle parsing failures gracefully upstream
  date: Date | Timestamp | null; // Date of the ticket (ensure consistency)
  client: string; // Client name or identifier (used for grouping and searching - potentially legacy if raisonSociale is primary)
  raisonSociale?: string; // Official client name for grouping/sorting
  description: string; // Ticket description
  statut: string; // Ticket status (e.g., 'Nouveau', 'En cours', 'Résolu')
  secteur: string; // Added during fetch to indicate the source sector/collection
  demandeSAP?: string; // Optional field used for automatic status correction

  // Fields inspired by TicketList reference
  numeroSAP?: string; // Optional: SAP ticket number
  deducedSalesperson?: string; // Optional: Salesperson name
  adresse?: string; // Optional: Client address associated with the ticket
  telephone?: string; // Optional: Phone number(s), potentially comma-separated

  // Add other relevant fields from your Firestore documents:
  codeClient?: string; // Optional: If you have a separate client code
  // priorite?: string; // Example: 'Haute', 'Moyenne', 'Basse'
  // technicien?: string; // Example: Assigned technician's name or ID
  // resolution?: string; // Example: Details of the resolution

  // Fields for TicketSAPDetails component
  descriptionProbleme?: string; // Main problem description (might overlap with 'description')
  statutSAP?: string; // Specific status used in the details modal (might overlap with 'statut')
  commentaires?: string[]; // Array of comments
  summary?: string; // AI Generated Summary
  solution?: string; // AI Generated Solution
  // ... other ticket properties
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
export interface Installation {
  id: string; // Firestore document ID
  secteur: 'CHR' | 'HACCP' | 'Tabac' | 'Kezia' | string; // Source sector

  // Fields from spreadsheet/InstallationTile
  dateCdeMateriel?: string | Timestamp | Date | { seconds: number; nanoseconds: number } | null;
  ca?: string;
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

  // New status field
  status: InstallationStatus;

  // Timestamps
  createdAt: Timestamp | Date | { seconds: number; nanoseconds: number };
  updatedAt: Timestamp | Date | { seconds: number; nanoseconds: number };

  // Optional: Link back to spreadsheet row if needed, e.g., using row index or a unique ID from the sheet
  // spreadsheetRowIndex?: number;
}
