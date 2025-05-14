import { google } from 'googleapis';
import { getGoogleAuthClient } from './google.server';
import type { UserSessionData } from '~/services/session.server';
import type { Installation } from '~/types/firestore.types';

export async function checkAvailabilityAndCreateBalanceEvent(
  session: UserSessionData,
  installation: Installation
): Promise<{ success: boolean; error?: string }> {
  try {
    // Vérifier si c'est une installation Kezia avec une balance
    if (installation.secteur.toLowerCase() !== 'kezia' || !installation.balance) {
      return { success: true }; // Pas besoin de créer d'événement
    }

    const auth = await getGoogleAuthClient(session);
    const calendar = google.calendar({ version: 'v3', auth });

    // Calculer la date de vérification (1 semaine avant l'installation)
    const installDate = new Date(installation.dateInstall);
    const verificationDate = new Date(installDate);
    verificationDate.setDate(verificationDate.getDate() - 7);

    // Vérifier la disponibilité dans la semaine précédant l'installation
    const weekStart = new Date(verificationDate);
    weekStart.setDate(weekStart.getDate() - 3); // 3 jours avant
    const weekEnd = new Date(verificationDate);
    weekEnd.setDate(weekEnd.getDate() + 3); // 3 jours après

    const events = await calendar.events.list({
      calendarId: 'primary',
      timeMin: weekStart.toISOString(),
      timeMax: weekEnd.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    // Trouver un créneau disponible
    let availableSlot = null;
    const busySlots = events.data.items || [];

    // Parcourir les jours de la semaine
    for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
      // Vérifier uniquement les jours de semaine (lundi-vendredi)
      if (d.getDay() === 0 || d.getDay() === 6) continue;

      // Vérifier les créneaux de 9h à 17h
      for (let hour = 9; hour < 17; hour++) {
        const slotStart = new Date(d);
        slotStart.setHours(hour, 0, 0, 0);
        const slotEnd = new Date(d);
        slotEnd.setHours(hour + 1, 0, 0, 0);

        // Vérifier si le créneau est libre
        const isSlotFree = !busySlots.some(event => {
          const eventStart = new Date(event.start?.dateTime || '');
          const eventEnd = new Date(event.end?.dateTime || '');
          return (slotStart >= eventStart && slotStart < eventEnd) ||
                 (slotEnd > eventStart && slotEnd <= eventEnd);
        });

        if (isSlotFree) {
          availableSlot = { start: slotStart, end: slotEnd };
          break;
        }
      }
      if (availableSlot) break;
    }

    if (!availableSlot) {
      return {
        success: false,
        error: 'Aucun créneau disponible trouvé pour la vérification de balance'
      };
    }

    // Créer l'événement de vérification
    const event = {
      summary: `Vérification Balance - ${installation.nom}`,
      description: `Vérification de la balance pour l'installation chez ${installation.nom} (${installation.codeClient})\nAdresse: ${installation.adresse || installation.ville}\nContact: ${installation.contact || 'N/A'}\nTéléphone: ${installation.telephone || 'N/A'}`,
      start: {
        dateTime: availableSlot.start.toISOString(),
        timeZone: 'Europe/Paris',
      },
      end: {
        dateTime: availableSlot.end.toISOString(),
        timeZone: 'Europe/Paris',
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 },
          { method: 'popup', minutes: 30 },
        ],
      },
    };

    await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
    });

    return { success: true };
  } catch (error) {
    console.error('Erreur lors de la création de l\'événement de vérification:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    };
  }
} 