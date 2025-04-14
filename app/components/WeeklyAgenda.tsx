import React, { useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarDays, faSpinner, faExclamationTriangle, faLink } from '@fortawesome/free-solid-svg-icons';

// Type for Calendar Event (simplified, should match loader)
interface CalendarEvent {
    id: string;
    summary?: string | null;
    start?: { dateTime?: string | null; date?: string | null } | null;
    end?: { dateTime?: string | null; date?: string | null } | null;
    htmlLink?: string | null;
}

interface WeeklyAgendaProps {
  events: CalendarEvent[];
  error: string | null;
  isLoading: boolean;
}

// Helper to format event time/date for display within the agenda item
const formatEventTime = (eventDateTime?: { dateTime?: string | null; date?: string | null } | null): string => {
    if (!eventDateTime) return '';
    // If dateTime exists (specific time), format it
    if (eventDateTime.dateTime) {
        try {
            // Use local time for display
            return new Date(eventDateTime.dateTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        } catch { return 'Heure invalide'; }
    }
    // If only date exists (all-day event)
    if (eventDateTime.date) {
        return 'Journée'; // Indicate all-day
    }
    return '';
};

// Helper to get the day of the week (0=Sun, 1=Mon, ..., 6=Sat) from an event start time
const getEventDayOfWeek = (eventStart?: { dateTime?: string | null; date?: string | null } | null): number | null => {
    if (!eventStart) return null;
    const dateString = eventStart.dateTime || eventStart.date;
    if (!dateString) return null;
    try {
        const date = new Date(dateString);
        return date.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat)
    } catch {
        return null;
    }
};

const dayNames = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const daysToShow = [1, 2, 3, 4, 5]; // Monday to Friday

export const WeeklyAgenda: React.FC<WeeklyAgendaProps> = ({ events, error, isLoading }) => {

    // Group events by day of the week (1-5 for Mon-Fri)
    const eventsByDay = useMemo(() => {
        const grouped: Record<number, CalendarEvent[]> = {};
        daysToShow.forEach(dayIndex => grouped[dayIndex] = []);

        events.forEach(event => {
            const dayOfWeek = getEventDayOfWeek(event.start);
            if (dayOfWeek !== null && daysToShow.includes(dayOfWeek)) {
                grouped[dayOfWeek].push(event);
            }
        });

        // Sort events within each day by start time
        Object.keys(grouped).forEach(day => {
            grouped[Number(day)].sort((a, b) => {
                const timeA = a.start?.dateTime || '';
                const timeB = b.start?.dateTime || '';
                return timeA.localeCompare(timeB);
            });
        });

        return grouped;
    }, [events]);

    if (isLoading) {
        return (
             <div className="bg-jdc-card p-4 rounded-lg shadow-lg min-h-[200px] flex items-center justify-center">
                 <FontAwesomeIcon icon={faSpinner} spin className="text-jdc-yellow text-xl mr-2" />
                 <span className="text-jdc-gray-400">Chargement de l'agenda...</span>
            </div>
        );
    }

    return (
        <div className="bg-jdc-card p-4 rounded-lg shadow-lg">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                <FontAwesomeIcon icon={faCalendarDays} className="mr-2 text-jdc-blue" />
                Agenda de la semaine
            </h3>

            {error && (
                 <div className="text-red-400 bg-red-900 bg-opacity-50 p-3 rounded mb-4">
                     <FontAwesomeIcon icon={faExclamationTriangle} className="mr-1" /> {error}
                 </div>
             )}

            {!error && events.length === 0 && (
                 <p className="text-jdc-gray-400">Aucun événement trouvé pour cette période.</p>
             )}

            {!error && events.length > 0 && (
                <div className="grid grid-cols-5 gap-4">
                    {daysToShow.map(dayIndex => (
                        <div key={dayIndex} className="p-3 rounded-lg bg-jdc-gray-800">
                            <h4 className="text-center text-jdc-blue font-semibold">{dayNames[dayIndex]}</h4>
                            <ul className="mt-2 space-y-2">
                                {eventsByDay[dayIndex]?.map((event: CalendarEvent) => (
                                    <li key={event.id} className="text-jdc-gray-300 text-sm">
                                        <span className="block font-medium text-jdc-gray-200 break-words">
                                            {event.summary || '(Sans titre)'}
                                        </span>
                                        <span className="text-jdc-gray-400">
                                            {formatEventTime(event.start)}
                                            {formatEventTime(event.start) && formatEventTime(event.end) && formatEventTime(event.start) !== formatEventTime(event.end) ? ` - ${formatEventTime(event.end)}` : ''}
                                        </span>
                                        {event.htmlLink && (
                                            <a href={event.htmlLink} target="_blank" rel="noopener noreferrer" className="text-jdc-blue hover:text-jdc-yellow ml-1">
                                                <FontAwesomeIcon icon={faLink} size="xs" />
                                            </a>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
