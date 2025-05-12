import type { MetaFunction } from "@remix-run/node";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useOutletContext, useLoaderData, useRevalidator, useSearchParams } from "@remix-run/react";
import { loader } from "./tickets-sap.loader";
import { action } from "./tickets-sap.action";
import type { TicketsSapLoaderData } from "./tickets-sap.loader";
import type { SapTicket, UserProfile } from "~/types/firestore.types";
import type { UserSessionData } from "~/services/session.server"; // Correction du type
import { Input } from "~/components/ui/Input";
import { Button } from "~/components/ui/Button";
import TicketSAPDetails from "~/components/TicketSAPDetails";
import {
  FaTicketAlt, FaFilter, FaSearch, FaSpinner,
  FaExclamationTriangle, FaPhone, FaMapMarkerAlt, FaUserTie, FaInfoCircle,
  FaCalendarAlt, FaBuilding, FaChevronDown, FaClipboardList, FaCheckCircle,
  FaClock, FaHourglassHalf, FaEllipsisH, FaClipboard, FaLock, FaUnlock
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
  user: UserSessionData | null; // Correction du type
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
    <div className="space-y-6"> {/* p-4 retiré, sera géré par le layout parent. bg-jdc-black et animate retirés */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-text-primary flex items-center">
          <FaTicketAlt className="mr-3 text-brand-blue h-7 w-7" />
          Gestion des Tickets SAP
        </h1>
        {isLoading && <FaSpinner className="ml-3 text-brand-blue animate-spin" title="Rafraîchissement..." />}
      </div>

      {/* Bandeau de statistiques */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="glass-card bg-gradient-to-br from-gray-900/80 to-gray-800/80 rounded-xl p-6 border border-white/10 hover:border-white/20 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 rounded-full bg-gray-400/30 border-2 border-white/20 shadow-lg">
              <FaClipboard className="text-white text-xl drop-shadow" />
            </div>
            <h3 className="font-bold text-lg text-white">Total</h3>
          </div>
          <div className="text-3xl font-bold text-white mt-2">{ticketStats.total}</div>
        </div>

        <div className="glass-card bg-gradient-to-br from-red-400/20 to-red-700/30 rounded-xl p-6 border border-red-400/20 hover:border-red-400/40 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl shadow-red-400/20">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 rounded-full bg-red-400/30 border-2 border-white/20 shadow-lg">
              <FaUnlock className="text-white text-xl drop-shadow" />
            </div>
            <h3 className="font-bold text-lg text-white">Ouverts</h3>
          </div>
          <div className="text-3xl font-bold text-white mt-2">{ticketStats.ouverts}</div>
        </div>

        <div className="glass-card bg-gradient-to-br from-orange-400/20 to-orange-700/30 rounded-xl p-6 border border-orange-400/20 hover:border-orange-400/40 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl shadow-orange-400/20">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 rounded-full bg-orange-400/30 border-2 border-white/20 shadow-lg">
              <FaClock className="text-white text-xl drop-shadow" />
            </div>
            <h3 className="font-bold text-lg text-white">En cours</h3>
          </div>
          <div className="text-3xl font-bold text-white mt-2">{ticketStats.enCours}</div>
        </div>

        <div className="glass-card bg-gradient-to-br from-green-400/20 to-green-700/30 rounded-xl p-6 border border-green-400/20 hover:border-green-400/40 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl shadow-green-400/20">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 rounded-full bg-green-400/30 border-2 border-white/20 shadow-lg">
              <FaLock className="text-white text-xl drop-shadow" />
            </div>
            <h3 className="font-bold text-lg text-white">Clos</h3>
          </div>
          <div className="text-3xl font-bold text-white mt-2">{ticketStats.clos}</div>
        </div>

        <div className="glass-card bg-gradient-to-br from-blue-400/20 to-blue-700/30 rounded-xl p-6 border border-blue-400/20 hover:border-blue-400/40 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl shadow-blue-400/20">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 rounded-full bg-blue-400/30 border-2 border-white/20 shadow-lg">
              <FaHourglassHalf className="text-white text-xl drop-shadow" />
            </div>
            <h3 className="font-bold text-lg text-white">Autres</h3>
          </div>
          <div className="text-3xl font-bold text-white mt-2">{ticketStats.autres}</div>
        </div>
      </div>

      {/* Filtres sticky */}
      <div className="sticky top-16 z-20 bg-white/5 backdrop-blur-md rounded-lg shadow-lg border border-white/10 p-3 mb-6"> {/* Styles glassmorphiques du nouveau thème, z-20 pour être sous le header (z-30) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label htmlFor="sector-filter" className="block text-xs font-medium text-text-secondary mb-1">
              Secteur
            </label>
            <select
              id="sector-filter"
              name="sector-filter"
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              className="block w-full rounded-md bg-ui-background/70 border-ui-border focus:border-brand-blue focus:ring focus:ring-brand-blue/40 text-text-primary py-1.5 px-2 text-xs shadow-sm"
              disabled={isLoading || availableSectors.length === 0}
            >
              <option value="">Tous</option>
              {availableSectors.map(sector => (
                <option key={sector} value={sector}>{sector}</option>
              ))}
            </select>
            {availableSectors.length === 0 && !isLoading && !loaderError && (
              <p className="text-xs text-text-tertiary mt-1">Aucun secteur assigné.</p>
            )}
          </div>
          <div>
            <label htmlFor="status-filter" className="block text-xs font-medium text-text-secondary mb-1">
              Statut
            </label>
            <select
              id="status-filter"
              name="status-filter"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="block w-full rounded-md bg-ui-background/70 border-ui-border focus:border-brand-blue focus:ring focus:ring-brand-blue/40 text-text-primary py-1.5 px-2 text-xs shadow-sm"
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
          <div className="col-span-1 md:col-span-2"> {/* Ajustement pour que la recherche prenne plus de place */}
            <Input
              label="Rechercher..."
              id="search-client"
              name="search-client"
              placeholder="Nom, ID, mot-clé..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              icon={<FaSearch className="text-text-tertiary"/>}
              wrapperClassName="mb-0"
              disabled={isLoading}
              className="bg-ui-background/70 text-text-primary border-ui-border focus:border-brand-blue focus:ring-brand-blue py-1.5 px-2 text-xs"
              labelClassName="text-text-secondary text-xs"
            />
          </div>
        </div>
      </div>

      {!isLoading && !loaderError && filteredTickets.length === 0 && (
        <div className="text-center text-text-secondary py-10">
          {allTickets.length > 0
            ? "Aucun ticket trouvé correspondant à votre recherche ou filtre."
            : "Aucun ticket SAP trouvé pour les secteurs assignés."}
        </div>
      )}

      {!isLoading && !loaderError && filteredTickets.length > 0 && (
        <div className="bg-ui-surface shadow-lg rounded-lg overflow-hidden">
          <div className="divide-y divide-ui-border"> {/* Séparateurs entre les tickets */}
            {paginatedTickets.map((ticket, idx) => {
              const statusStyle = getTicketStatusStyle(ticket.statut || 'N/A'); // Sera adapté plus tard
              const displayDate = formatDate(ticket.date);
              const phoneNumbers = getStringValue(ticket.telephone, '').split(',').map((n: string) => n.trim()).filter((n: string) => n) || [];
              return (
                <div
                  key={ticket.id}
                  className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 px-4 py-3 hover:bg-ui-background transition-colors group cursor-pointer"
                  onClick={() => handleTicketClick(ticket)}
                >
                  {/* Colonne gauche : infos principales */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-md font-semibold text-text-primary truncate" title={getStringValue(ticket.raisonSociale, 'N/A')}>
                        {getStringValue(ticket.raisonSociale, 'N/A')}
                      </span>
                      {ticket.codeClient && (
                        <span className="text-xs text-text-secondary">({getStringValue(ticket.codeClient)})</span>
                      )}
                      <span className={`ml-auto md:ml-2 inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${statusStyle.bgColor} ${statusStyle.textColor} border border-transparent`}> {/* borderColor retiré pour l'instant */}
                        {typeof ticket.statut === 'object' && ticket.statut !== null && 'stringValue' in ticket.statut
                          ? ticket.statut.stringValue
                          : ticket.statut || 'N/A'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary">
                      <span>{getStringValue(ticket.client, '')}</span>
                      {ticket.deducedSalesperson && (
                        <span>Comm: <span className="font-medium text-text-primary">{getStringValue(ticket.deducedSalesperson)}</span></span>
                      )}
                      <span>Sect: <span className="font-medium text-text-primary">{ticket.secteur || 'N/A'}</span></span>
                      <span className="flex items-center"><FaCalendarAlt className="mr-1.5 text-text-tertiary" />{displayDate}</span>
                    </div>
                    {ticket.adresse && (
                      <div className="text-xs text-text-secondary mt-1 flex items-center">
                        <FaMapMarkerAlt className="mr-1.5 text-text-tertiary flex-shrink-0" />
                        <span className="truncate" title={getStringValue(ticket.adresse, '')}>{getStringValue(ticket.adresse)}</span>
                      </div>
                    )}
                  </div>
                  {/* Colonne droite : actions */}
                  <div className="flex flex-row items-center gap-2 mt-2 md:mt-0 md:ml-4" onClick={e => e.stopPropagation()}>
                    {phoneNumbers.length > 0 && (
                      <div className="relative">
                        <Button
                          variant="outline"
                          size="sm"  // Changé de xs à sm
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleWebexCall(ticket.id, phoneNumbers); }}
                          className="text-brand-blue border-brand-blue hover:bg-brand-blue hover:text-white p-1.5" // Padding ajusté pour taille xs-like
                          title={phoneNumbers.length === 1 ? `Appeler ${phoneNumbers[0]}` : "Appeler..."}
                        >
                          <FaPhone className="h-3 w-3"/> {/* Taille icone ajustée */}
                        </Button>
                        {showNumberOptions[ticket.id] && phoneNumbers.length > 1 && (
                          <div className="absolute right-0 mt-1 w-40 bg-ui-surface backdrop-blur-sm rounded-md shadow-lg z-10 border border-ui-border">
                            <ul className="py-1">
                              {phoneNumbers.map((number: string, index: number) => (
                                <li key={index}>
                                  <a
                                    href={`webexphone://call?uri=tel:${number}`}
                                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleNumberSelection(number); setShowNumberOptions(prev => ({ ...prev, [ticket.id]: false })); }}
                                    className="block px-3 py-1.5 text-xs text-text-primary hover:bg-ui-background rounded-md"
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
                    <Button
                      variant="outline"
                      size="sm" // Changé de xs à sm
                      type="button"
                      onClick={async (e) => { 
                        e.stopPropagation();
                        const isClosed = getStringValue(ticket.statut, '').toLowerCase().includes('clos') || getStringValue(ticket.statut, '').toLowerCase().includes('fermé');
                        if (!isClosed) {
                          handleRequestClose(ticket);
                        } else {
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
                      className={`p-1.5 ${ // Padding ajusté pour taille xs-like
                        getStringValue(ticket.statut, '').toLowerCase().includes('clos') || getStringValue(ticket.statut, '').toLowerCase().includes('fermé')
                          ? 'text-green-500 border-green-500 hover:bg-green-500 hover:text-white'
                          : 'text-red-500 border-red-500 hover:bg-red-500 hover:text-white'
                      }`}
                      title={
                        getStringValue(ticket.statut, '').toLowerCase().includes('clos') || getStringValue(ticket.statut, '').toLowerCase().includes('fermé')
                          ? 'Rouvrir le ticket'
                          : 'Clore le ticket'
                      }
                    >
                       {getStringValue(ticket.statut, '').toLowerCase().includes('clos') || getStringValue(ticket.statut, '').toLowerCase().includes('fermé') 
                         ? <FaExclamationTriangle className="h-3 w-3"/> 
                         : <FaExclamationTriangle className="h-3 w-3"/>}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pagination */}
      {!isLoading && !loaderError && totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="text-brand-blue border-brand-blue hover:bg-brand-blue hover:text-white"
          >
            Précédent
          </Button>
          <span className="text-text-secondary font-medium mx-2 text-sm">Page {currentPage} / {totalPages}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="text-brand-blue border-brand-blue hover:bg-brand-blue hover:text-white"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"> {/* Fond général de la modale */}
          <div className="bg-ui-surface backdrop-blur-md border border-ui-border rounded-lg shadow-xl p-6 w-full max-w-md mx-auto"> {/* Style glassmorphique pour la carte modale */}
            <h2 className="text-xl font-semibold text-text-primary mb-4">Clôturer le ticket</h2>
            <p className="text-text-secondary mb-3 text-sm">Merci de renseigner une note du technicien pour clôturer ce ticket.</p>
            <textarea
              className="w-full min-h-[100px] rounded-md bg-ui-background/70 text-text-primary border border-ui-border p-2 text-sm focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none mb-4"
              value={technicianNoteInput}
              onChange={e => setTechnicianNoteInput(e.target.value)}
              placeholder="Ajouter une note technique..."
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                size="sm"
                className="border-ui-border text-text-secondary hover:bg-ui-border hover:text-text-primary"
                onClick={() => setIsCloseNoteModalOpen(false)}
              >
                Annuler
              </Button>
              <Button
                variant="primary" 
                size="sm"
                className="bg-brand-blue text-white hover:bg-brand-blue-dark" // Utilisation de brand-blue pour le bouton primaire
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
