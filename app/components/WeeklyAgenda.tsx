import React, { useRef, useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import frLocale from '@fullcalendar/core/locales/fr';
import { getWeekDateRangeForAgenda, formatFirestoreDate } from "~/utils/dateUtils"; // Import ajouté
import { FaCalendarAlt, FaSpinner, FaExclamationTriangle, FaChevronLeft, FaChevronRight } from 'react-icons/fa';

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
                : new Date().toISOString();
        const endDate = event.end?.dateTime
            ? event.end.dateTime
            : event.end?.date
                ? event.end.date
                : new Date(new Date(startDate).getTime() + 3600000).toISOString();
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

    const buttonStyle = "p-2 rounded-full bg-white/10 border border-white/20 hover:bg-jdc-yellow hover:text-gray-900 transition-all duration-200 shadow-md";

    if (isLoading) {
        return (
            <div className="glass-card bg-gradient-to-br from-gray-800/80 to-gray-900/90 p-8 rounded-2xl shadow-2xl border border-white/10 min-h-[220px] flex items-center justify-center animate-pulse">
                <FaSpinner className="text-jdc-yellow text-2xl mr-3 animate-spin" />
                <span className="text-gray-300 text-lg font-medium">Chargement de l'agenda...</span>
            </div>
        );
    }

    return (
        <div className="glass-card bg-gradient-to-br from-gray-900/80 to-gray-800/90 rounded-2xl shadow-2xl border border-white/10 p-8 flex flex-col transition-all duration-300">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-extrabold text-white flex items-center drop-shadow-lg">
                    <FaCalendarAlt className="mr-3 text-jdc-yellow text-2xl" />
                    Agenda de la semaine
                </h3>
                <div className="flex items-center space-x-2">
                    <button
                        onClick={handlePrevWeek}
                        className={buttonStyle}
                        aria-label="Semaine précédente"
                    >
                        <FaChevronLeft />
                    </button>
                    <button
                        onClick={handleToday}
                        className="text-sm px-3 py-1 rounded-full bg-white/10 border border-white/20 text-jdc-yellow hover:bg-jdc-yellow hover:text-gray-900 font-semibold shadow-md transition-all duration-200"
                    >
                        Aujourd'hui
                    </button>
                    <button
                        onClick={handleNextWeek}
                        className={buttonStyle}
                        aria-label="Semaine suivante"
                    >
                        <FaChevronRight />
                    </button>
                </div>
            </div>
            {error && (
                <div className="text-red-400 bg-red-900/60 p-4 rounded-xl mb-4 flex items-center gap-2 shadow-md animate-fade-in-up">
                    <FaExclamationTriangle className="text-xl" /> <span>{error}</span>
                </div>
            )}
            {!error && events.length === 0 && (
                <p className="text-gray-400 text-lg">Aucun événement trouvé pour cette période.</p>
            )}
            {!error && events.length > 0 && (
                <div className="h-[350px] animate-fade-in-up">
                    <FullCalendar
                        ref={calendarRef}
                        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                        initialView="timeGridWeek"
                        locale={frLocale}
                        events={formattedEvents}
                        headerToolbar={{ left: '', center: 'title', right: '' }}
                        slotMinTime="08:00:00"
                        slotMaxTime="20:00:00"
                        allDaySlot={false}
                        eventBackgroundColor="#facc15"
                        eventBorderColor="#facc15"
                        eventTextColor="#1f2937"
                        dayHeaderFormat={{ weekday: 'long', day: 'numeric', month: 'numeric' }}
                        slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
                        nowIndicator={true}
                        height="100%"
                        dayCellClassNames="bg-gray-800 border-gray-700"
                        slotLaneClassNames="border-gray-700"
                    />
                </div>
            )}
        </div>
    );
};

// Ajoute dans tailwind.config.js :
// animation: {
//   'fade-in-up': 'fadeInUp 0.6s cubic-bezier(0.39, 0.575, 0.565, 1) both',
//   'pulse-slow': 'pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
// },
// keyframes: {
//   fadeInUp: {
//     '0%': { opacity: 0, transform: 'translateY(20px)' },
//     '100%': { opacity: 1, transform: 'translateY(0)' },
//   },
// },
