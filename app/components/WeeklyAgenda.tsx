import React, { useMemo } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format } from 'date-fns/format';
import { parse } from 'date-fns/parse';
import { startOfWeek } from 'date-fns/startOfWeek';
import { getDay } from 'date-fns/getDay';
import { fr } from 'date-fns/locale';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarDays, faSpinner, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import 'react-big-calendar/lib/css/react-big-calendar.css';

// Type for Calendar Event (compatible with react-big-calendar)
interface CalendarEvent {
    id: string;
    title: string;
    start: Date;
    end: Date;
    allDay?: boolean;
    resource?: any;
}

interface WeeklyAgendaProps {
  events: Array<{
    id: string;
    summary?: string | null;
    start?: { dateTime?: string | null; date?: string | null } | null;
    end?: { dateTime?: string | null; date?: string | null } | null;
    htmlLink?: string | null;
  }>;
  error: string | null;
  isLoading: boolean;
}

// Configuration du calendrier en français
const locales = {
    fr: fr,
};

const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek,
    getDay,
    locales,
});

// Convertit les événements Google Calendar au format attendu par react-big-calendar
const convertEvents = (events: WeeklyAgendaProps['events']): CalendarEvent[] => {
    return events.map(event => {
        const startDate = event.start?.dateTime 
            ? new Date(event.start.dateTime)
            : event.start?.date 
                ? new Date(event.start.date)
                : new Date();
                
        const endDate = event.end?.dateTime 
            ? new Date(event.end.dateTime)
            : event.end?.date 
                ? new Date(event.end.date)
                : new Date(startDate.getTime() + 3600000); // +1h par défaut
            
        return {
            id: event.id,
            title: event.summary || '(Sans titre)',
            start: startDate,
            end: endDate,
            allDay: !event.start?.dateTime,
        };
    });
};

export const WeeklyAgenda: React.FC<WeeklyAgendaProps> = ({ events, error, isLoading }) => {
    // Convertit les événements au format attendu
    const formattedEvents = useMemo(() => convertEvents(events), [events]);

    if (isLoading) {
        return (
             <div className="bg-jdc-card p-4 rounded-lg shadow-lg min-h-[200px] flex items-center justify-center">
                 <FontAwesomeIcon icon={faSpinner} spin className="text-jdc-yellow text-xl mr-2" />
                 <span className="text-jdc-gray-400">Chargement de l'agenda...</span>
            </div>
        );
    }

    return (
            <div className="bg-jdc-card p-4 rounded-lg shadow-lg h-[600px]">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                    <FontAwesomeIcon icon={faCalendarDays} className="mr-2 text-jdc-blue text-base" />
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
                    <Calendar
                        localizer={localizer}
                        events={formattedEvents}
                        startAccessor="start"
                        endAccessor="end"
                        style={{ height: 500 }}
                        culture="fr"
                        messages={{
                            today: "Aujourd'hui",
                            previous: "Précédent",
                            next: "Suivant",
                            month: "Mois",
                            week: "Semaine",
                            day: "Jour",
                            agenda: "Agenda",
                            date: "Date",
                            time: "Heure",
                            event: "Événement",
                            noEventsInRange: "Aucun événement dans cette période",
                        }}
                        eventPropGetter={(event: CalendarEvent) => ({
                            style: {
                                backgroundColor: '#3b82f6', // jdc-blue
                                borderColor: '#1d4ed8', // darker blue
                                color: 'white',
                                borderRadius: '4px',
                                border: 'none',
                            },
                        })}
                    />
                )}
            </div>
    );
};
