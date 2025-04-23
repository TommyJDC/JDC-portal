import React, { useState, useMemo } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, addWeeks } from 'date-fns';
import { fr } from 'date-fns/locale';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarDays, faSpinner, faExclamationTriangle, faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import 'react-big-calendar/lib/css/react-big-calendar.css';

interface CalendarEvent {
    id: string;
    title: string;
    start: Date;
    end: Date;
    allDay?: boolean;
}

interface WeeklyAgendaProps {
  events: Array<{
    id: string;
    summary?: string | null;
    start?: { dateTime?: string | null; date?: string | null } | null;
    end?: { dateTime?: string | null; date?: string | null } | null;
  }>;
  error: string | null;
  isLoading: boolean;
}

const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1 }),
    getDay,
    locales: { fr },
});

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
                : new Date(startDate.getTime() + 3600000);
            
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
    const [currentDate, setCurrentDate] = useState(new Date());
    const formattedEvents = useMemo(() => convertEvents(events), [events]);

    const handleNavigate = (newDate: Date) => setCurrentDate(newDate);
    const handlePrevWeek = () => setCurrentDate(addWeeks(currentDate, -1));
    const handleNextWeek = () => setCurrentDate(addWeeks(currentDate, 1));

    const buttonStyle = "p-2 rounded-full hover:bg-gray-700 transition-colors text-jdc-yellow";

    if (isLoading) {
        return (
            <div className="bg-gray-800 p-6 rounded-xl shadow-2xl border border-gray-700 min-h-[200px] flex items-center justify-center">
                <FontAwesomeIcon icon={faSpinner} spin className="text-jdc-yellow text-xl mr-2" />
                <span className="text-gray-400">Chargement de l'agenda...</span>
            </div>
        );
    }

    return (
        <div className="bg-gray-800 p-6 rounded-xl shadow-2xl border border-gray-700 h-[600px]">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-white flex items-center">
                    <FontAwesomeIcon icon={faCalendarDays} className="mr-2 text-jdc-yellow" />
                    Agenda de la semaine
                </h3>
                
                <div className="flex items-center space-x-2">
                    <button 
                        onClick={handlePrevWeek}
                        className={buttonStyle}
                        aria-label="Semaine précédente"
                    >
                        <FontAwesomeIcon icon={faChevronLeft} />
                    </button>
                    
                    <button 
                        onClick={() => setCurrentDate(new Date())}
                        className="text-sm text-jdc-yellow hover:underline"
                    >
                        Aujourd'hui
                    </button>
                    
                    <button 
                        onClick={handleNextWeek}
                        className={buttonStyle}
                        aria-label="Semaine suivante"
                    >
                        <FontAwesomeIcon icon={faChevronRight} />
                    </button>
                </div>
            </div>

            {error && (
                <div className="text-red-400 bg-red-900 bg-opacity-50 p-3 rounded mb-4">
                    <FontAwesomeIcon icon={faExclamationTriangle} className="mr-1" /> {error}
                </div>
            )}

            {!error && events.length === 0 && (
                <p className="text-gray-400">Aucun événement trouvé pour cette période.</p>
            )}

            {!error && events.length > 0 && (
                <Calendar
                    localizer={localizer}
                    events={formattedEvents}
                    date={currentDate}
                    onNavigate={handleNavigate}
                    startAccessor="start"
                    endAccessor="end"
                    style={{ height: 500 }}
                    culture="fr"
                    defaultView="week"
                    views={['week']}
                    min={new Date(0, 0, 0, 8, 0, 0)} // 8h
                    max={new Date(0, 0, 0, 20, 0, 0)} // 20h
                    messages={{
                        today: "Aujourd'hui",
                        previous: "Précédent",
                        next: "Suivant",
                        week: "Semaine",
                        noEventsInRange: "Aucun événement cette semaine",
                    }}
                    eventPropGetter={() => ({
                        style: {
                            backgroundColor: '#facc15', // yellow-400
                            border: 'none',
                            borderRadius: '4px',
                            color: '#1f2937', // gray-800
                            padding: '4px 8px',
                            fontSize: '14px',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                        },
                    })}
                    components={{
                        event: ({ event }) => (
                            <div className="hover:bg-yellow-500 hover:shadow-lg transition-all duration-200">
                                {event.title}
                            </div>
                        ),
                    }}
                    dayPropGetter={(date) => ({
                        style: {
                            backgroundColor: getDay(date) === 0 || getDay(date) === 6 
                                ? 'rgba(31, 41, 55, 0.5)' // gray-800 with opacity
                                : '#1f2937', // gray-800
                        },
                    })}
                     // Ajuster les styles des en-têtes et des cellules du calendrier
                    // Utiliser des classes CSS personnalisées si nécessaire, ou des styles inline
                    // Exemple de styles inline pour les en-têtes de jour (peut nécessiter d'inspecter les classes de react-big-calendar)
                    // headerStyle: { backgroundColor: '#1f2937', color: '#d1d5db' }, // gray-800, gray-300
                    // cellStyle: { border: '1px solid #374151' }, // gray-700
                />
            )}
        </div>
    );
};
