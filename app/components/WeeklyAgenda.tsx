import React, { useRef, useMemo } from 'react';
import FullCalendar from '@fullcalendar/react'; // Import par défaut corrigé
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import frLocale from '@fullcalendar/core/locales/fr';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarDays, faSpinner, faExclamationTriangle, faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';
interface CalendarEvent {
    id: string;
    title: string;
    start: string | Date;
    end: string | Date;
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

const convertEvents = (events: WeeklyAgendaProps['events']): CalendarEvent[] => {
    return events.map(event => {
        const startDate = event.start?.dateTime
            ? event.start.dateTime
            : event.start?.date
                ? event.start.date
                : new Date().toISOString(); // Fallback to current date string

        const endDate = event.end?.dateTime
            ? event.end.dateTime
            : event.end?.date
                ? event.end.date
                : new Date(new Date(startDate).getTime() + 3600000).toISOString(); // Fallback to 1 hour after start

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
    const calendarRef = useRef<FullCalendar>(null);
    const formattedEvents = useMemo(() => convertEvents(events), [events]);

    const handlePrevWeek = () => {
        if (calendarRef.current) {
            calendarRef.current.getApi().prev();
        }
    };

    const handleNextWeek = () => {
        if (calendarRef.current) {
            calendarRef.current.getApi().next();
        }
    };

    const handleToday = () => {
        if (calendarRef.current) {
            calendarRef.current.getApi().today();
        }
    };

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
        <div className="bg-gray-800 p-6 rounded-xl shadow-2xl border border-gray-700 hover:border-jdc-blue transition-all duration-300 ease-in-out flex flex-col">
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
                        onClick={handleToday}
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
                <div className="h-[350px]"> {/* Fixed height container */}
                    <FullCalendar
                        ref={calendarRef}
                        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                        initialView="timeGridWeek"
                        locale={frLocale}
                        events={formattedEvents}
                        headerToolbar={{
                            left: '',
                            center: 'title',
                            right: ''
                        }}
                        slotMinTime="08:00:00"
                        slotMaxTime="20:00:00"
                        allDaySlot={false}
                        eventBackgroundColor="#facc15" // yellow-400
                        eventBorderColor="#facc15" // yellow-400
                        eventTextColor="#1f2937" // gray-800
                        dayHeaderFormat={{ weekday: 'long', day: 'numeric', month: 'numeric' }}
                        slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
                        nowIndicator={true}
                        height="100%" // Fill parent container
                        dayCellClassNames="bg-gray-800 border-gray-700" // Apply background and border to day cells
                        slotLaneClassNames="border-gray-700" // Apply border to time slots
                        // eventContent={(arg) => (
                        //     <div className="hover:bg-yellow-500 hover:shadow-lg transition-all duration-200 p-1 rounded">
                        //         {arg.timeText && <strong>{arg.timeText}</strong>}
                        //         <br/>
                        //         {arg.event.title}
                        //     </div>
                        // )}
                    />
                </div>
            )}
        </div>
    );
};
