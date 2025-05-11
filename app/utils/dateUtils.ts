export function formatDate(date: Date | null): string {
  if (!date) return 'N/A';
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function convertFirestoreDate(date: any): Date | null {
  if (!date) return null;
  if (date instanceof Date) return date;
  if (date.seconds && date.nanoseconds) {
    return new Date(date.seconds * 1000 + date.nanoseconds / 1000000);
  }
  try {
    return new Date(date);
  } catch {
    return null;
  }
}

export function formatFirestoreDate(date: Date | null): string {
  return formatDate(date);
}

export function getWeekDateRangeForAgenda(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay()); // Début de semaine (dimanche)
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6); // Fin de semaine (samedi)
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

/**
 * Calcule le numéro de semaine ISO 8601 pour une date donnée
 * @param date La date pour laquelle calculer le numéro de semaine
 * @returns Le numéro de semaine ISO 8601 (1-53)
 */
export function getISOWeekNumber(date: Date): number {
  // Copie de la date pour ne pas modifier l'original
  const d = new Date(date);
  
  // Définir sur le jeudi de la semaine courante
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 3);
  
  // Janvier 4 est toujours dans la semaine 1
  const firstThursday = new Date(d.getFullYear(), 0, 4);
  firstThursday.setDate(firstThursday.getDate() - ((firstThursday.getDay() + 6) % 7) + 3);
  
  // Nombre de millisecondes depuis le premier jeudi de l'année
  const diff = d.getTime() - firstThursday.getTime();
  
  // Calculer le numéro de semaine: 1 + nombre de semaines écoulées
  return 1 + Math.floor(diff / (7 * 24 * 3600 * 1000));
}
