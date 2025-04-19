import { Timestamp } from 'firebase/firestore';

export function parseFrenchDate(dateString: string): Date | null {
  if (!dateString) return null;
  
  // Format français : JJ/MM/AAAA
  const parts = dateString.split('/');
  if (parts.length !== 3) return null;
  
  const day = parseInt(parts[0]);
  const month = parseInt(parts[1]) - 1;
  const year = parseInt(parts[2]);
  return new Date(year, month, day);
}

export function formatDateForDisplay(date: Date | string): string {
  if (!date) return 'N/A';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  return dateObj.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function getWeekDateRangeForAgenda() {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 (dimanche) à 6 (samedi)
  const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Ajuste pour lundi comme premier jour
  const startOfWeek = new Date(today.setDate(diff));
  startOfWeek.setHours(0, 0, 0, 0);
  
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6); // Ajoute 6 jours pour avoir dimanche
  endOfWeek.setHours(23, 59, 59, 999);

  return { startOfWeek, endOfWeek };
}

export function formatFirestoreDate(
  date: Date | Timestamp | string | { seconds: number; nanoseconds: number } | null | undefined
): string {
  if (!date) return 'N/A';
  
  let dateObj: Date;
  
  if (date instanceof Timestamp) {
    dateObj = date.toDate();
  } else if (typeof date === 'string') {
    return date; // Already formatted
  } else if (date instanceof Date) {
    dateObj = date;
  } else if (date.seconds && date.nanoseconds) {
    dateObj = new Date(date.seconds * 1000 + date.nanoseconds / 1000000);
  } else {
    return 'N/A';
  }

  return dateObj.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}
