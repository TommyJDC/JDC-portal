import { format, getISOWeek } from 'date-fns';
import { fr } from 'date-fns/locale';

export function convertFirestoreDate(date: any): Date | null {
    if (!date) return null;

    let convertedDate: Date | null = null;

    try {
        // Si c'est déjà un objet Date valide
        if (date instanceof Date && !isNaN(date.getTime())) {
            convertedDate = date;
        }
        // Si c'est un Timestamp Firestore
        else if (date?.toDate) {
            const firestoreDate = date.toDate();
            if (firestoreDate instanceof Date && !isNaN(firestoreDate.getTime())) {
                convertedDate = firestoreDate;
            }
        }
        // Si c'est un objet avec des secondes/nanosecondes (format potentiel de sérialisation)
        else if (typeof date === 'object' && date.seconds !== undefined) {
            const dateFromSeconds = new Date(date.seconds * 1000 + (date.nanoseconds || 0) / 1000000);
            if (!isNaN(dateFromSeconds.getTime())) {
                convertedDate = dateFromSeconds;
            }
        }
        // Si c'est un objet avec _seconds/_nanoseconds (format Timestamp direct)
        else if (typeof date === 'object' && date._seconds !== undefined) {
            const dateFrom_seconds = new Date(date._seconds * 1000 + (date._nanoseconds || 0) / 1000000);
             if (!isNaN(dateFrom_seconds.getTime())) {
                convertedDate = dateFrom_seconds;
            }
        }
        // Si c'est une string ISO ou autre format parsable par Date
        else if (typeof date === 'string') {
            const parsedDate = new Date(date);
            if (!isNaN(parsedDate.getTime())) {
                convertedDate = parsedDate;
            }
        }

        // Appliquer la correction de l'année 2001 si nécessaire
        if (convertedDate instanceof Date && !isNaN(convertedDate.getTime())) {
             // Vérifier si l'année est 2001 et si la date est dans le passé
            if (convertedDate.getFullYear() === 2001 && convertedDate < new Date()) {
                convertedDate.setFullYear(2025);
            }
        }

        return convertedDate;

    } catch (error) {
        console.error('Error converting date:', date, error);
        return null;
    }
}

export function parseSerializedDateNullable(date: any, defaultValue: string = '', returnDateObject: boolean = false): Date | string | null {
    if (date === null || date === undefined) {
        return returnDateObject ? new Date(0) : defaultValue;
    }

    const convertedDate = convertFirestoreDate(date);

    if (!convertedDate || isNaN(convertedDate.getTime())) {
        return returnDateObject ? new Date(0) : defaultValue;
    }

    return returnDateObject ? convertedDate : convertedDate.toISOString();
}

// Nouvelle fonction pour formater les dates
export function formatFirestoreDate(date: Date | null | undefined, formatString: string = 'dd/MM/yyyy'): string {
    if (!date) {
        return '';
    }
    try {
        return format(date, formatString, { locale: fr });
    } catch (error) {
        console.error('Error formatting date:', date, error);
        return '';
    }
}

// Nouvelle fonction pour obtenir la plage de dates de la semaine
export function getWeekDateRangeForAgenda(date: Date): { start: Date; end: Date } {
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay() + (date.getDay() === 0 ? -6 : 1)); // Lundi
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // Dimanche
    endOfWeek.setHours(23, 59, 59, 999);

    return { start: startOfWeek, end: endOfWeek };
}

// Nouvelle fonction pour obtenir le numéro de semaine ISO
export function getISOWeekNumber(date: Date): number {
    return getISOWeek(date);
}
