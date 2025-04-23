import type { Installation, InstallationStatus, InstallationFilters, SapTicket, UserProfile, Shipment, StatsSnapshot, Article } from "~/types/firestore.types";

// Déclaration de type pour firestore.service.server
declare module '~/services/firestore.service.server' {
  // Fonctions d'installation
  export function getInstallationsBySector(
    sector: string, 
    userSectors?: string[], 
    isAdmin?: boolean, 
    filters?: InstallationFilters
  ): Promise<Installation[]>;
  export function getClientCodesWithShipment(sector: string): Promise<Set<string>>;
  export function updateInstallation(id: string, updates: Partial<Installation>): Promise<void>;
  export function addInstallation(installationData: Omit<Installation, 'id' | 'createdAt' | 'updatedAt'>): Promise<any>;
  export function getInstallationById(id: string): Promise<Installation | null>;
  export function deleteInstallation(installationId: string): Promise<void>;
  export function bulkUpdateInstallations(ids: string[], updates: Partial<Installation>): Promise<void>;

  // Fonctions utilisateur
  export function getUserProfileSdk(userId: string): Promise<UserProfile | null>;
  export function getAllUserProfilesSdk(): Promise<UserProfile[]>;
  export function updateUserProfileSdk(userId: string, updates: Partial<UserProfile>): Promise<void>;
  export function createUserProfileSdk(profile: UserProfile): Promise<void>;

  // Fonctions tickets et envois
  export function getRecentTicketsForSectors(sectors: string[], limit: number): Promise<SapTicket[]>;
  export function getTotalTicketCountSdk(sectors: string[]): Promise<number>;
  export function getDistinctClientCountFromEnvoiSdk(userProfile: UserProfile): Promise<number>;
  export function getLatestStatsSnapshotsSdk(limit: number): Promise<StatsSnapshot[]>;
  export function updateSAPTICKET(sector: string, ticketId: string, updates: Partial<SapTicket>): Promise<void>;
  export function getAllTicketsForSectorsSdk(sectors: string[]): Promise<SapTicket[]>;
  export function deleteShipmentSdk(shipmentId: string): Promise<void>;
  export function getAllShipments(sectors: string[]): Promise<Shipment[]>;

  // Fonctions articles
  export function searchArticles(params: { code?: string; nom?: string }, tags?: string[]): Promise<Article[]>;
  export function addArticleImageUrl(articleId: string, imageUrl: string): Promise<void>;
  export function deleteArticleImageUrl(articleId: string, imageUrl: string): Promise<void>;

  // Fonctions géocodage
  export function getGeocodeFromCache(address: string): Promise<{ lat: number, lng: number } | null>;
  export function setGeocodeToCache(address: string, coordinates: { lat: number, lng: number }): Promise<void>;
}

// Extend HTMLElement to include the _root property for React 18 compatibility
declare global {
  interface HTMLElement {
    _root?: import('react-dom/client').Root;
  }
}
