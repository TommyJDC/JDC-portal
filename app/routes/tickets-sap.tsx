import type { MetaFunction } from "@remix-run/node";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useOutletContext, useLoaderData, useRevalidator, useSearchParams } from "@remix-run/react";
import { loader } from "./tickets-sap.loader";
import { action } from "./tickets-sap.action";
import type { TicketsSapLoaderData } from "./tickets-sap.loader";
import type { SapTicket, UserProfile } from "~/types/firestore.types";
import type { UserSession } from "~/services/session.server";
import { Input } from "~/components/ui/Input";
import { Button } from "~/components/ui/Button";
import TicketSAPDetails from "~/components/TicketSAPDetails";
import {
  FaTicketAlt, FaFilter, FaSearch, FaSpinner,
  FaExclamationTriangle, FaPhone, FaMapMarkerAlt, FaUserTie, FaInfoCircle,
  FaCalendarAlt, FaBuilding, FaChevronDown
} from 'react-icons/fa';
import { getTicketStatusStyle } from "~/utils/styleUtils";
import { formatDate } from "~/utils/dateUtils";
import { getStringValue } from '~/utils/firestoreUtils';
import { useToast } from '~/context/ToastContext';
import { createPortal } from "react-dom";

export const meta: MetaFunction = () => {
  return [{ title: "Tickets SAP | JDC Dashboard" }];
};

interface JsonSapTicket extends Omit<SapTicket, 'date' | 'contactAttempts'> {
  date: string | null;
  contactAttempts?: Array<{
    date: string | null;
    notes: string;
    outcome: string;
  }>;
}

const parseSapTicketDates = (ticket: JsonSapTicket): SapTicket => ({
  ...ticket,
  date: ticket.date ? new Date(ticket.date) : null,
  contactAttempts: ticket.contactAttempts?.map(attempt => ({
    ...attempt,
    date: attempt.date ? new Date(attempt.date) : null
  }))
});

export { loader, action };

type OutletContextType = {
  user: UserSession | null;
};

const groupTicketsByRaisonSociale = (tickets: SapTicket[]): Map<string, SapTicket[]> => {
  const grouped = new Map<string, SapTicket[]>();
  tickets.forEach(ticket => {
    const raisonSociale = getStringValue(ticket.raisonSociale, 'N/A');
    const existing = grouped.get(raisonSociale) || [];
    existing.push(ticket);
    grouped.set(raisonSociale, existing);
  });
  return grouped;
};

export default function TicketsSap() {
  const { user } = useOutletContext<OutletContextType>();
  const { userProfile, allTickets: serializedTickets, error: loaderError } = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedSector, setSelectedSector] = useState(searchParams.get('sector') || '');
  const [searchTerm, setSearchTerm] = useState('');
  const [showNumberOptions, setShowNumberOptions] = useState<Record<string, boolean>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SapTicket | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const TICKETS_PER_PAGE = 10;
  const [selectedStatus, setSelectedStatus] = useState('');
  const [ticketToClose, setTicketToClose] = useState<SapTicket | null>(null);
  const [technicianNoteInput, setTechnicianNoteInput] = useState("");
  const [isCloseNoteModalOpen, setIsCloseNoteModalOpen] = useState(false);

  const allTickets = useMemo(() => 
    serializedTickets?.map(parseSapTicketDates) || [], 
    [serializedTickets]
  );

  const { addToast } = useToast();

  useEffect(() => {
    const newParams = new URLSearchParams(searchParams);
    if (selectedSector) newParams.set('sector', selectedSector);
    else newParams.delete('sector');
    setSearchParams(newParams, { replace: true });
  }, [selectedSector, setSearchParams, searchParams]);

  const availableSectors = useMemo(() => {
    if (userProfile?.role === 'Admin') {
      return ['CHR', 'HACCP', 'Kezia', 'Tabac'];
    }
    return userProfile?.secteurs?.slice().sort() || [];
  }, [userProfile]);

  // Pagination sur la liste plate de tickets (plus de regroupement par client)
  const filteredTickets = useMemo(() => {
    // On récupère tous les tickets filtrés (secteur, statut, recherche)
    let filtered = allTickets;
    if (selectedSector) {
      filtered = filtered.filter(t => t.secteur === selectedSector);
    }
    if (selectedStatus) {
      const status = selectedStatus.toLowerCase();
      filtered = filtered.filter(t => getStringValue(t.statut, '').toLowerCase().includes(status));
    }
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      filtered = filtered.filter(t =>
        getStringValue(t.raisonSociale, '').toLowerCase().includes(term) ||
        getStringValue(t.client, '').toLowerCase().includes(term) ||
        getStringValue(t.id, '').toLowerCase().includes(term) ||
        getStringValue(t.description, '').toLowerCase().includes(term) ||
        getStringValue(t.statut, '').toLowerCase().includes(term) ||
        getStringValue(t.numeroSAP, '').toLowerCase().includes(term) ||
        getStringValue(t.deducedSalesperson, '').toLowerCase().includes(term) ||
        getStringValue(t.adresse, '').toLowerCase().includes(term) ||
        getStringValue(t.telephone, '').toLowerCase().includes(term)
      );
    }
    // Tri par date décroissante
    return filtered.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
  }, [allTickets, searchTerm, selectedSector, selectedStatus]);

  const paginatedTickets = useMemo(() => {
    const start = (currentPage - 1) * TICKETS_PER_PAGE;
    const end = start + TICKETS_PER_PAGE;
    return filteredTickets.slice(start, end);
  }, [filteredTickets, currentPage]);

  const totalPages = Math.ceil(filteredTickets.length / TICKETS_PER_PAGE);

  const handleWebexCall = useCallback((ticketId: string, numbers: string[]) => {
    if (numbers.length === 1) {
      window.location.href = `webexphone://call?uri=tel:${numbers[0]}`;
      setShowNumberOptions(prev => ({ ...prev, [ticketId]: false }));
    } else {
      setShowNumberOptions(prev => ({ ...prev, [ticketId]: !prev[ticketId] }));
    }
  }, []);

  const handleNumberSelection = useCallback((number: string) => {
    window.location.href = `webexphone://call?uri=tel:${number}`;
  }, []);

  const handleTicketClick = (ticket: SapTicket) => {
    setSelectedTicket(ticket);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedTicket(null);
  };

  const handleTicketUpdated = useCallback(() => {
    revalidator.revalidate();
  }, [revalidator]);

  // Calcul des statistiques de tickets
  const ticketStats = useMemo(() => {
    const stats = {
      total: allTickets.length,
      ouverts: 0,
      enCours: 0,
      clos: 0,
      autres: 0,
    };
    allTickets.forEach(t => {
      const statut = getStringValue(t.statut, '').toLowerCase();
      if (statut.includes('ouvert')) stats.ouverts++;
      else if (statut.includes('cours')) stats.enCours++;
      else if (statut.includes('clos') || statut.includes('fermé')) stats.clos++;
      else stats.autres++;
    });
    return stats;
  }, [allTickets]);

  // Fonction pour gérer la demande de clôture
  const handleRequestClose = (ticket: SapTicket) => {
    const note = getStringValue((ticket as any).technicianNotes, "");
    if (!note.trim()) {
      setTicketToClose(ticket);
      setTechnicianNoteInput("");
      setIsCloseNoteModalOpen(true);
    } else {
      // Clôture directe si la note existe déjà
      handleCloseTicket(ticket, note);
    }
  };

  // Fonction pour envoyer la clôture
  const handleCloseTicket = async (ticket: SapTicket, note: string) => {
    const formData = new FormData();
    formData.append('intent', 'update_status');
    formData.append('ticketId', ticket.id);
    formData.append('sectorId', ticket.secteur || '');
    formData.append('newStatus', 'closed');
    formData.append('technicianNotes', note);
    await fetch('/tickets-sap', { method: 'POST', body: formData });
    setIsCloseNoteModalOpen(false);
    setTicketToClose(null);
    setTechnicianNoteInput("");
    handleTicketUpdated();
    addToast({ type: 'success', message: 'Ticket clôturé avec succès.' });
  };

  if (!user) return (
    <div className="text-center text-gray-400 py-10">
      Veuillez vous connecter pour voir les tickets SAP.
    </div>
  );

  if (loaderError) return (
    <div className="text-center text-red-400 bg-red-900 bg-opacity-50 p-4 rounded-lg flex items-center justify-center">
      <FaExclamationTriangle className="mr-2" />
      {loaderError}
    </div>
  );

  const isLoading = revalidator.state === 'loading';

  return (
    <div className="space-y-4 p-4 min-h-screen bg-jdc-black animate-fade-in-up">
      <h1 className="text-2xl font-extrabold text-jdc-yellow mb-4 flex items-center drop-shadow-lg animate-fade-in-up">
        <FaTicketAlt className="mr-3 text-jdc-yellow text-3xl" />
        Gestion des Tickets SAP
        {isLoading && <FaSpinner className="ml-3 text-jdc-yellow animate-spin" title="Rafraîchissement..." />}
      </h1>

      {/* Bandeau de statistiques */}
      <div className="flex flex-wrap gap-3 mb-4 animate-fade-in-up">
        <div className="flex-1 min-w-[140px] bg-jdc-yellow rounded-lg shadow-md p-3 flex flex-col items-center justify-center border border-jdc-yellow">
          <span className="text-xl font-bold text-jdc-black drop-shadow">{ticketStats.total}</span>
          <span className="text-xs font-semibold text-jdc-black uppercase tracking-wider">Total</span>
        </div>
        <div className="flex-1 min-w-[140px] bg-jdc-card rounded-lg shadow-md p-3 flex flex-col items-center justify-center border border-jdc-yellow">
          <span className="text-xl font-bold text-jdc-yellow drop-shadow">{ticketStats.ouverts}</span>
          <span className="text-xs font-semibold text-jdc-yellow uppercase tracking-wider">Ouverts</span>
        </div>
        <div className="flex-1 min-w-[140px] bg-jdc-card rounded-lg shadow-md p-3 flex flex-col items-center justify-center border border-jdc-yellow">
          <span className="text-xl font-bold text-jdc-yellow drop-shadow">{ticketStats.enCours}</span>
          <span className="text-xs font-semibold text-jdc-yellow uppercase tracking-wider">En cours</span>
        </div>
        <div className="flex-1 min-w-[140px] bg-jdc-card rounded-lg shadow-md p-3 flex flex-col items-center justify-center border border-jdc-yellow">
          <span className="text-xl font-bold text-jdc-yellow drop-shadow">{ticketStats.clos}</span>
          <span className="text-xs font-semibold text-jdc-yellow uppercase tracking-wider">Clos</span>
        </div>
        <div className="flex-1 min-w-[140px] bg-jdc-card rounded-lg shadow-md p-3 flex flex-col items-center justify-center border border-jdc-yellow">
          <span className="text-xl font-bold text-jdc-yellow drop-shadow">{ticketStats.autres}</span>
          <span className="text-xs font-semibold text-jdc-yellow uppercase tracking-wider">Autres</span>
        </div>
      </div>

      {/* Filtres sticky */}
      <div className="sticky top-16 z-30 bg-jdc-card bg-opacity-90 rounded-xl shadow-lg border border-jdc-yellow/50 mb-4 animate-fade-in-up backdrop-blur-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-3">
          <div className="col-span-1">
            <label htmlFor="sector-filter" className="block text-xs font-bold text-jdc-yellow mb-1 flex items-center gap-1">
              <FaFilter /> Secteur
            </label>
            <select
              id="sector-filter"
              name="sector-filter"
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              className="block w-full rounded-md bg-jdc-black border-jdc-yellow/50 focus:border-jdc-yellow focus:ring focus:ring-jdc-yellow/40 text-jdc-yellow py-1 px-2 text-xs shadow"
              disabled={isLoading || availableSectors.length === 0}
            >
              <option value="">Tous</option>
              {availableSectors.map(sector => (
                <option key={sector} value={sector}>{sector}</option>
              ))}
            </select>
            {availableSectors.length === 0 && !isLoading && !loaderError && (
              <p className="text-xs text-jdc-gray-400 mt-1">Aucun secteur assigné.</p>
            )}
          </div>
          <div className="col-span-1">
            <label htmlFor="status-filter" className="block text-xs font-bold text-jdc-yellow mb-1 flex items-center gap-1">
              Statut
            </label>
            <select
              id="status-filter"
              name="status-filter"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="block w-full rounded-md bg-jdc-black border-jdc-yellow/50 focus:border-jdc-yellow focus:ring focus:ring-jdc-yellow/40 text-jdc-yellow py-1 px-2 text-xs shadow"
              disabled={isLoading}
            >
              <option value="">Tous</option>
              <option value="ouvert">Ouverts</option>
              <option value="cours">En cours</option>
              <option value="clos">Clos</option>
              <option value="fermé">Fermés</option>
              <option value="attente">En attente</option>
              <option value="rma">RMA</option>
            </select>
          </div>
          <div className="col-span-2 md:col-span-2">
            <Input
              label="Rechercher..."
              id="search-client"
              name="search-client"
              placeholder="Nom, ID, mot-clé..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              icon={<FaSearch />}
              wrapperClassName="mb-0"
              disabled={isLoading}
              className="bg-jdc-black text-jdc-yellow border-jdc-yellow/50 focus:border-jdc-yellow focus:ring-jdc-yellow py-1 px-2 text-xs"
              labelClassName="text-jdc-yellow text-xs"
            />
          </div>
        </div>
      </div>

      {!isLoading && !loaderError && filteredTickets.length === 0 && (
        <div className="text-center text-jdc-gray-200 py-10 animate-fade-in-up">
          {allTickets.length > 0
            ? "Aucun ticket trouvé correspondant à votre recherche ou filtre."
            : "Aucun ticket SAP trouvé pour les secteurs assignés."}
        </div>
      )}

      {!isLoading && !loaderError && filteredTickets.length > 0 && (
        <div className="w-full flex flex-col divide-y divide-jdc-yellow/20 bg-jdc-card rounded-xl shadow-lg overflow-hidden animate-fade-in-up">
          {paginatedTickets.map((ticket, idx) => {
            const statusStyle = getTicketStatusStyle(ticket.statut || 'N/A');
            const displayDate = formatDate(ticket.date);
            const phoneNumbers = getStringValue(ticket.telephone, '').split(',').map((n: string) => n.trim()).filter((n: string) => n) || [];
            return (
              <div
                key={ticket.id}
                className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 px-3 py-2 hover:bg-jdc-yellow/10 transition-colors group relative cursor-pointer"
                style={{ animationDelay: `${0.1 + idx * 0.03}s` }}
                onClick={() => handleTicketClick(ticket)}
              >
                {/* Colonne gauche : infos principales */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-base font-bold text-jdc-yellow truncate" title={getStringValue(ticket.raisonSociale, 'N/A')}>
                      {getStringValue(ticket.raisonSociale, 'N/A')}
                    </span>
                    {ticket.codeClient && (
                      <span className="text-xs text-jdc-yellow">({getStringValue(ticket.codeClient)})</span>
                    )}
                    {/* Ajout d'un espace avant le badge statut */}
                    <span className="ml-2" />
                    <span className={`inline-block px-1.5 py-0.5 rounded-full text-xs font-semibold shadow ${statusStyle.bgColor} ${statusStyle.textColor} border border-jdc-yellow/30 drop-shadow`}>
                      {typeof ticket.statut === 'object' && ticket.statut !== null && 'stringValue' in ticket.statut
                        ? ticket.statut.stringValue
                        : ticket.statut || 'N/A'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-jdc-gray-300">
                    <span>{getStringValue(ticket.client, '')}</span>
                    {ticket.deducedSalesperson && (
                      <span className="ml-1">Comm: <span className="font-semibold text-jdc-yellow">{getStringValue(ticket.deducedSalesperson)}</span></span>
                    )}
                    <span className="ml-1">Sect: <span className="font-semibold text-jdc-yellow">{ticket.secteur || 'N/A'}</span></span>
                    <span className="ml-1 flex items-center"><FaCalendarAlt className="mr-1 text-jdc-yellow w-3" />{displayDate}</span>
                  </div>
                  {ticket.adresse && (
                    <div className="text-xs text-jdc-gray-400 mt-0.5 flex items-center">
                      <FaMapMarkerAlt className="mr-1.5 text-jdc-yellow w-3 flex-shrink-0" />
                      <span className="truncate" title={getStringValue(ticket.adresse, '')}>{getStringValue(ticket.adresse)}</span>
                    </div>
                  )}
                </div>
                {/* Colonne droite : actions */}
                <div className="flex flex-row items-center gap-2 mt-2 md:mt-0 md:ml-4" onClick={e => e.stopPropagation()}>
                  {/* Bouton Appeler */}
                  {phoneNumbers.length > 0 && (
                    <div className="relative">
                      <Button
                        variant="outline"
                        size="sm" 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleWebexCall(ticket.id, phoneNumbers);
                        }}
                        className="text-jdc-yellow border-jdc-yellow hover:bg-jdc-yellow hover:text-jdc-black"
                        title={phoneNumbers.length === 1 ? `Appeler ${phoneNumbers[0]}` : "Appeler..."}
                      >
                        <FaPhone className="w-3 h-3"/>
                      </Button>
                      {showNumberOptions[ticket.id] && phoneNumbers.length > 1 && (
                        <div className="absolute right-0 mt-1 w-40 bg-jdc-card backdrop-blur-sm rounded-md shadow-lg z-10 border border-jdc-yellow/50 animate-fade-in-up">
                          <ul className="py-0.5">
                            {phoneNumbers.map((number: string, index: number) => (
                              <li key={index}>
                                <a
                                  href={`webexphone://call?uri=tel:${number}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    handleNumberSelection(number);
                                    setShowNumberOptions(prev => ({ ...prev, [ticket.id]: false }));
                                  }}
                                  className="block px-2 py-1 text-xs text-jdc-yellow hover:bg-jdc-yellow hover:text-jdc-black rounded-md transition-all"
                                >
                                  {number}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                  {/* Bouton Clore/Rouvrir */}
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation();
                      const isClosed = getStringValue(ticket.statut, '').toLowerCase().includes('clos') || getStringValue(ticket.statut, '').toLowerCase().includes('fermé');
                      if (!isClosed) {
                        handleRequestClose(ticket);
                      } else {
                        // Réouverture directe
                        const formData = new FormData();
                        formData.append('intent', 'update_status');
                        formData.append('ticketId', ticket.id);
                        formData.append('sectorId', ticket.secteur || '');
                        formData.append('newStatus', 'open');
                        await fetch('/tickets-sap', { method: 'POST', body: formData });
                        handleTicketUpdated();
                        addToast({ type: 'success', message: 'Ticket rouvert avec succès.' });
                      }
                    }}
                    className={
                      getStringValue(ticket.statut, '').toLowerCase().includes('clos') || getStringValue(ticket.statut, '').toLowerCase().includes('fermé')
                        ? 'text-jdc-yellow border-jdc-yellow hover:bg-jdc-yellow hover:text-jdc-black' // Vert -> Jaune
                        : 'text-jdc-gray-400 border-jdc-gray-400 hover:bg-jdc-gray-400 hover:text-jdc-black'
                    }
                    title={
                      getStringValue(ticket.statut, '').toLowerCase().includes('clos') || getStringValue(ticket.statut, '').toLowerCase().includes('fermé')
                        ? 'Rouvrir le ticket'
                        : 'Clore le ticket'
                    }
                  >
                    {getStringValue(ticket.statut, '').toLowerCase().includes('clos') || getStringValue(ticket.statut, '').toLowerCase().includes('fermé') ? (
                      <span title="Rouvrir"><FaExclamationTriangle className="w-3 h-3"/></span>
                    ) : (
                      <span title="Clore"><FaExclamationTriangle className="w-3 h-3"/></span>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {!isLoading && !loaderError && totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-6 animate-fade-in-up">
          <Button
            variant="outline" // Changed from secondary
            size="sm" // Changed from sm
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="text-jdc-yellow border-jdc-yellow hover:bg-jdc-yellow hover:text-jdc-black"
          >
            Précédent
          </Button>
          <span className="text-jdc-yellow font-semibold mx-1 text-xs">Page {currentPage} / {totalPages}</span>
          <Button
            variant="outline" // Changed from secondary
            size="sm" // Changed from sm
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="text-jdc-yellow border-jdc-yellow hover:bg-jdc-yellow hover:text-jdc-black"
          >
            Suivant
          </Button>
        </div>
      )}

      {isModalOpen && selectedTicket && (
        <TicketSAPDetails
          ticket={selectedTicket}
          sectorId={selectedTicket.secteur}
          onClose={handleCloseModal}
          onTicketUpdated={handleTicketUpdated}
        />
      )}

      {/* Popup modale de saisie de note pour clôture */}
      {isCloseNoteModalOpen && ticketToClose && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-jdc-black/70 backdrop-blur-md">
          <div className="bg-jdc-card border-2 border-jdc-yellow rounded-xl shadow-xl p-6 w-full max-w-md mx-auto animate-fade-in-up">
            <h2 className="text-xl font-bold text-jdc-yellow mb-3">Clôturer le ticket</h2>
            <p className="text-jdc-yellow mb-2 text-sm">Merci de renseigner une note du technicien pour clôturer ce ticket.</p>
            <textarea
              className="w-full min-h-[100px] rounded-md bg-jdc-black text-jdc-yellow border border-jdc-yellow/50 p-2 text-sm focus:border-jdc-yellow focus:ring-jdc-yellow outline-none mb-3"
              value={technicianNoteInput}
              onChange={e => setTechnicianNoteInput(e.target.value)}
              placeholder="Ajouter une note technique..."
              autoFocus
            />
            <div className="flex justify-end gap-3 mt-2">
              <Button
                variant="outline"
                size="sm"
                className="border-jdc-yellow text-jdc-yellow hover:bg-jdc-yellow hover:text-jdc-black font-semibold px-4"
                onClick={() => setIsCloseNoteModalOpen(false)}
              >
                Annuler
              </Button>
              <Button
                variant="primary" // Assuming primary is yellow background
                size="sm"
                className="bg-jdc-yellow text-jdc-black hover:bg-opacity-80 font-semibold px-4"
                onClick={async () => {
                  if (!technicianNoteInput.trim()) return;
                  await handleCloseTicket(ticketToClose, technicianNoteInput.trim());
                }}
                disabled={!technicianNoteInput.trim()}
              >
                Valider
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
