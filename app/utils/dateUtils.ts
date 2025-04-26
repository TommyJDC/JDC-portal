import { Timestamp } from 'firebase/firestore';

export function formatDateForDisplay(date: Date | string | null | undefined): string {
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

// Calcul du numéro de semaine ISO 8601
export function getISOWeeekNumber(date: Date = new Date()): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function formatFirestoreDate(
  date: Date | Timestamp | string | { seconds: number; nanoseconds: number } | null | undefined,
  options?: {
    defaultValue?: string
    returnDateObject?: boolean
  }
): string | Date {
  const { defaultValue = 'N/A', returnDateObject = false } = options || {};

  console.log('formatFirestoreDate: Input received:', date, 'Type:', typeof date);

  // Explicitly check for null or undefined
  if (date == null) {
    console.log('formatFirestoreDate: Input is null/undefined, returning default value:', defaultValue);
    return returnDateObject ? new Date(0) : defaultValue;
  }
  
  let dateObj: Date;
  
  try {
    if (date instanceof Timestamp) {
      console.log('formatFirestoreDate: Input is Timestamp, converting to Date:', date);
      dateObj = date.toDate();
    } else if (typeof date === 'string') {
      console.log('formatFirestoreDate: Input is string:', date);
      const trimmedDate = date.trim();
      // Try to parse if it's an ISO string
      if (trimmedDate.includes('T')) {
        console.log('formatFirestoreDate: Trying to parse as ISO string');
        dateObj = new Date(trimmedDate);
        if (isNaN(dateObj.getTime())) {
          console.log('formatFirestoreDate: ISO string parsing failed, returning original string');
          return date; // Return original if invalid
        }
      }
       else {
        console.log('formatFirestoreDate: String format not recognized, returning original string');
        return date; // Already formatted or unrecognized string
      }
    } else if (date instanceof Date) {
      console.log('formatFirestoreDate: Input is Date object:', date);
      dateObj = date;
    } else if (date && typeof date === 'object' && 'seconds' in date && 'nanoseconds' in date) {
       console.log('formatFirestoreDate: Input is { seconds, nanoseconds } object:', date);
      dateObj = new Date(date.seconds * 1000 + date.nanoseconds / 1000000);
    }
     else {
      console.log('formatFirestoreDate: Unrecognized date format or type', date, typeof date);
      return defaultValue; // Return default for unrecognized types
    }

    if (isNaN(dateObj.getTime())) {
      console.log('formatFirestoreDate: Resulting Date object is Invalid Date', dateObj);
      return defaultValue; // Return default if the resulting Date object is invalid
    }

    // Check if the year is in the past (e.g., 2001) and update to current year if necessary
    const currentYear = new Date().getFullYear();
    if (dateObj.getFullYear() < currentYear) {
        console.log(`formatFirestoreDate: Detected past year ${dateObj.getFullYear()}, updating to current year ${currentYear}`);
        dateObj.setFullYear(currentYear);
    }


    if (returnDateObject) {
      console.log('formatFirestoreDate: returnDateObject is true, returning Date object:', dateObj);
      return dateObj;
    }

    const options: Intl.DateTimeFormatOptions = {
      day: '2-digit',
      month: '2-digit',
    };

    const formatted = dateObj.toLocaleDateString('fr-FR', options);

    console.log('formatFirestoreDate: Successfully formatted date:', formatted);
    return formatted || defaultValue;
  } catch (error) {
    console.error('formatFirestoreDate error during processing:', error, 'Input was:', date);
    return defaultValue; // Return default on any error during processing
  }
}
