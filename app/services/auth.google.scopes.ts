// Liste des scopes Google OAuth requis pour l'application
export const GOOGLE_OAUTH_SCOPES = [
  // Scopes de base
  "openid",
  "email",
  "profile",
  
  // Scopes Gmail
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.labels",
  
  // Scopes Calendar
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
  
  // Scopes Drive
  "https://www.googleapis.com/auth/drive.readonly"
];

// Scopes spécifiques pour la vérification des accès Gmail
export const GMAIL_REQUIRED_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.labels"
];

// Scopes spécifiques pour la vérification des accès Calendar
export const CALENDAR_REQUIRED_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events"
];

// Scopes spécifiques pour la vérification des accès Drive
export const DRIVE_REQUIRED_SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly"
];

// Fonction d'aide pour vérifier si les scopes requis sont présents
export function hasRequiredScopes(availableScopes: string[], requiredScopes: string[]): boolean {
  return requiredScopes.every(scope => availableScopes.includes(scope));
}

// Fonction pour vérifier l'accès aux services Google spécifiques
export function checkGoogleServicesAccess(scopes: string[]) {
  return {
    gmail: hasRequiredScopes(scopes, GMAIL_REQUIRED_SCOPES),
    calendar: hasRequiredScopes(scopes, CALENDAR_REQUIRED_SCOPES),
    drive: hasRequiredScopes(scopes, DRIVE_REQUIRED_SCOPES)
  };
} 