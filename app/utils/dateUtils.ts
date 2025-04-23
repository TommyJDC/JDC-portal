import { Timestamp } from 'firebase/firestore';

export function parseFrenchDateFromString(dateString: string): Date | null {
  if (!dateString) return null;
  
  // Format: "mardi 22 avril 2025"
  const trimmedDateString = dateString.trim(); // Supprimer les espaces blancs en début et fin
  const parts = trimmedDateString.split(' ');
  if (parts.length !== 4) {
    console.error(`parseFrenchDateFromString: Invalid parts length for "${dateString}". Expected 4, got ${parts.length}. Parts:`, parts);
    return null;
  }
  
  const day = parseInt(parts[1]);
  const month = getMonthNumber(parts[2]);
  const year = parseInt(parts[3]);
  
  if (isNaN(day)) return null;
  if (month === -1) return null;
  if (isNaN(year)) return null;
  
  return new Date(year, month, day);
}

function getMonthNumber(monthName: string): number {
  const months = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
  ];
  return months.findIndex(m => m === monthName.toLowerCase());
}

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

export function formatFirestoreDate(
  date: Date | Timestamp | string | { seconds: number; nanoseconds: number } | null | undefined,
  options?: {
    defaultValue?: string
    returnDateObject?: boolean
  }
): string | Date {
  const { defaultValue = 'N/A', returnDateObject = false } = options || {};

  console.log('formatFirestoreDate: Input received:', date, 'Type:', typeof date);

  if (!date) {
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
      // Try to parse French date string (e.g., "mardi 22 avril 2025")
      else if (/[a-z]+ \d{1,2} [a-z]+ \d{4}/i.test(trimmedDate)) {
        console.log('formatFirestoreDate: Trying to parse as full French date string');
        const parsed = parseFrenchDateFromString(trimmedDate);
        if (parsed) {
          console.log('formatFirestoreDate: Full French date string parsed successfully:', parsed);
          dateObj = parsed;
        }
        else {
          console.log('formatFirestoreDate: Full French date string parsing failed, returning original string');
          return date; // Return original if can't parse
        }
      }
      // Try to parse French date string without year (e.g., "05/06") and add current year
      else if (/^\d{1,2}\/\d{1,2}$/.test(trimmedDate)) {
        console.log('formatFirestoreDate: Trying to parse as JJ/MM string and add current year');
        const currentYear = new Date().getFullYear();
        const dateWithYear = `${trimmedDate}/${currentYear}`;
        const parsed = parseFrenchDate(dateWithYear); // Use parseFrenchDate for JJ/MM/AAAA
         if (parsed) {
          console.log('formatFirestoreDate: JJ/MM string parsed successfully with current year:', parsed);
          dateObj = parsed;
        } else {
           console.log('formatFirestoreDate: JJ/MM string parsing failed, returning original string');
           return date; // Return original if can't parse even with year
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

    const dateYear = dateObj.getFullYear();

    const options: Intl.DateTimeFormatOptions = {
      day: '2-digit',
      month: '2-digit',
    };

    // Only show year if it's not the current year (after potentially updating it)
    if (dateYear !== currentYear) {
      options.year = 'numeric';
    }

    const formatted = dateObj.toLocaleDateString('fr-FR', options);

    console.log('formatFirestoreDate: Successfully formatted date:', formatted);
    return formatted || defaultValue;
  } catch (error) {
    console.error('formatFirestoreDate error during processing:', error, 'Input was:', date);
    return defaultValue; // Return default on any error during processing
  }
}
