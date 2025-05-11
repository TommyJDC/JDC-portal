import React, { useState, useEffect } from "react";
import { useFetcher } from "@remix-run/react";
import { Button } from "./ui/Button";
import { 
  FaBell, FaEnvelope, FaExclamationTriangle, 
  FaInfoCircle, FaCheckCircle, FaTrash,
  FaEye, FaEyeSlash, FaUsers, FaUser, FaUserTag,
  FaSync, FaPaperPlane, FaPlusCircle, FaTimes
} from "react-icons/fa";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  userId: string;
  isRead: boolean;
  createdAt: string;
  operator?: string;
}

interface NotificationActionResponse {
  success?: boolean;
  message?: string;
  error?: string;
  id?: string;
}

export function NotificationPanel() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  
  const [newNotification, setNewNotification] = useState({
    title: "", message: "", type: "info", targetType: "all", targetValue: ""
  });
  
  const notificationsFetcher = useFetcher<{notifications: Notification[], error?: string}>();
  const actionFetcher = useFetcher<NotificationActionResponse>();
  const directNotificationFetcher = useFetcher<NotificationActionResponse>();
  const diagnosticFetcher = useFetcher<{success?: boolean, message?: string, data?: any, error?: string}>();
  
  const [directNotificationIds, setDirectNotificationIds] = useState<string[]>([]);
  const [diagnosticResults, setDiagnosticResults] = useState<any>(null);
  const [runningDiagnostic, setRunningDiagnostic] = useState(false);
  
  useEffect(() => { fetchNotifications(); }, []);
  
  const fetchNotifications = () => {
    setLoading(true);
    const devParam = import.meta.env.DEV ? "?dev_bypass=true" : "";
    notificationsFetcher.load(`/api/admin/notifications${devParam}`);
  };
  
  useEffect(() => {
    if (notificationsFetcher.data) {
      setNotifications(notificationsFetcher.data.notifications || []);
      setLoading(false);
    }
  }, [notificationsFetcher.data]);
  
  useEffect(() => {
    if (directNotificationFetcher.data?.success && directNotificationFetcher.data?.id) {
      setDirectNotificationIds(prev => [...prev, directNotificationFetcher.data!.id!]);
      setTimeout(fetchNotifications, 1000);
    }
  }, [directNotificationFetcher.data]);
  
  useEffect(() => {
    if (actionFetcher.data?.success) {
      fetchNotifications();
      if (actionFetcher.data.id) {
        setNewNotification({ title: "", message: "", type: "info", targetType: "all", targetValue: "" });
        setFormErrors({}); // Clear form errors on successful submission
      }
    } else if (actionFetcher.data?.error) {
      // Potentially set form-level errors if applicable, or just log
      console.error('[NotificationPanel] Action Error:', actionFetcher.data.error);
      setTimeout(fetchNotifications, 1000); // Refresh to ensure data consistency
    }
  }, [actionFetcher.data]);
  
  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!newNotification.title.trim()) errors.title = "Le titre est requis";
    if (!newNotification.message.trim()) errors.message = "Le message est requis";
    if (newNotification.targetType !== "all" && !newNotification.targetValue.trim()) errors.targetValue = "La valeur cible est requise";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    let userId = "";
    if (newNotification.targetType === "role") userId = `role:${newNotification.targetValue}`;
    else if (newNotification.targetType === "user") userId = newNotification.targetValue;
    const devParam = import.meta.env.DEV ? "?dev_bypass=true" : "";
    actionFetcher.submit({ action: "create", ...newNotification, userId }, { method: "post", action: `/api/admin/notifications${devParam}` });
  };
  
  const markAsRead = (id: string) => {
    const devParam = import.meta.env.DEV ? "?dev_bypass=true" : "";
    actionFetcher.submit({ action: "markAsRead", id }, { method: "post", action: `/api/admin/notifications${devParam}`});
  };

  const formatDate = (dateString: string) => new Date(dateString).toLocaleString();

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "info": return <FaInfoCircle className="text-blue-400 h-4 w-4" />;
      case "warning": return <FaExclamationTriangle className="text-yellow-400 h-4 w-4" />;
      case "error": return <FaExclamationTriangle className="text-red-400 h-4 w-4" />;
      case "success": return <FaCheckCircle className="text-green-400 h-4 w-4" />;
      default: return <FaBell className="text-text-tertiary h-4 w-4" />;
    }
  };

  const getTargetIcon = (userId: string) => {
    if (!userId || userId === "all") return <FaUsers className="text-text-tertiary h-3.5 w-3.5" title="Tous les utilisateurs" />;
    if (userId.startsWith("role:")) return <FaUserTag className="text-text-tertiary h-3.5 w-3.5" title={`Rôle: ${userId.substring(5)}`} />;
    return <FaUser className="text-text-tertiary h-3.5 w-3.5" title={`Utilisateur: ${userId}`} />;
  };

  const getTargetText = (userId: string) => {
    if (!userId || userId === "all") return "Tous";
    if (userId.startsWith("role:")) return `Rôle: ${userId.substring(5)}`;
    return `ID: ${userId.substring(0,8)}...`;
  };

  const testCreateNotification = () => {
    actionFetcher.submit(
      { action: "create", title: "Test Notif " + new Date().toLocaleTimeString(), message: "Message de test.", type: "info", userId: "" },
      { method: "post", action: `/api/admin/notifications${import.meta.env.DEV ? "?dev_bypass=true" : ""}` }
    );
    setTimeout(fetchNotifications, 1500);
  };

  const createDirectNotification = () => {
    const notifId = `direct_${Date.now().toString(36)}`;
    directNotificationFetcher.submit(
      { action: "create", notificationId: notifId, title: `Notif Directe ${new Date().toLocaleTimeString()}`, message: `ID: ${notifId}`, type: "info", userId: "all" },
      { method: "post", action: `/api/direct-notifications${import.meta.env.DEV ? "?dev_bypass=true" : ""}` }
    );
  };

  const deleteNotification = (id: string): void => {
    if (!id) return;
    if (directNotificationIds.includes(id)) { deleteDirectNotification(id); return; }
    const devParam = import.meta.env.DEV ? "?dev_bypass=true" : "";
    actionFetcher.submit({ action: "delete", id }, { method: "post", action: `/api/admin/notifications${devParam}`});
  };

  const deleteDirectNotification = (id: string): void => {
    if (!directNotificationIds.includes(id)) { deleteNotification(id); return; }
    directNotificationFetcher.submit({ action: "delete", id }, { method: "post", action: `/api/direct-notifications${import.meta.env.DEV ? "?dev_bypass=true" : ""}`});
    setDirectNotificationIds(prev => prev.filter(item => item !== id));
    setTimeout(fetchNotifications, 1000);
  };
  
  const runNotificationsDiagnostic = () => {
    setRunningDiagnostic(true);
    diagnosticFetcher.load(`/api/notifications/diagnostics${import.meta.env.DEV ? "?dev_bypass=true" : ""}`);
  };

  useEffect(() => { if (diagnosticFetcher.data) { setRunningDiagnostic(false); setDiagnosticResults(diagnosticFetcher.data); } }, [diagnosticFetcher.data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <h2 className="text-lg font-semibold text-text-primary">Gestion des Notifications</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={fetchNotifications} variant="outline" size="sm" disabled={loading} className="border-ui-border text-text-secondary hover:bg-ui-border hover:text-text-primary">
            {loading && <FaSync className="mr-1.5 h-3.5 w-3.5 animate-spin" />} {loading ? "Chargement..." : "Rafraîchir"}
          </Button>
          <Button onClick={testCreateNotification} variant="primary" size="sm" className="bg-brand-blue hover:bg-brand-blue-dark text-white">
            <FaPlusCircle className="mr-1.5 h-3.5 w-3.5" /> Test Notif
          </Button>
          <Button onClick={createDirectNotification} variant="primary" size="sm" className="bg-brand-blue hover:bg-brand-blue-dark text-white" disabled={directNotificationFetcher.state === "submitting"}>
            <FaPlusCircle className="mr-1.5 h-3.5 w-3.5" /> {directNotificationFetcher.state === "submitting" ? "Création..." : "Notif Directe"}
          </Button>
          <Button onClick={runNotificationsDiagnostic} variant="outline" size="sm" className="border-ui-border text-text-secondary hover:bg-ui-border hover:text-text-primary" disabled={runningDiagnostic}>
            {runningDiagnostic && <FaSync className="mr-1.5 h-3.5 w-3.5 animate-spin" />} {!runningDiagnostic && <FaInfoCircle className="mr-1.5 h-3.5 w-3.5" />} {runningDiagnostic ? "Analyse..." : "Diagnostiquer"}
          </Button>
        </div>
      </div>
      
      {notificationsFetcher.data?.error && ( <div className="p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-300"><p className="font-semibold text-sm">Erreur:</p><p className="text-xs">{notificationsFetcher.data.error}</p></div> )}
      {actionFetcher.data && ( <div className={`p-3 rounded-md border ${actionFetcher.data.error ? 'bg-red-500/10 border-red-500/30 text-red-300' : 'bg-green-500/10 border-green-500/30 text-green-300'}`}><p className="font-semibold text-sm">{actionFetcher.data.error ? 'Erreur Action:' : 'Succès:'}</p><p className="text-xs">{actionFetcher.data.error || actionFetcher.data.message}</p></div> )}
      {diagnosticResults && (
        <div className={`p-3 rounded-md border ${
          diagnosticResults.error 
            ? 'bg-red-500/10 border-red-500/30 text-red-300' 
            : 'bg-brand-blue/10 border-brand-blue/30 text-brand-blue-light'
        }`}>
          <div className="flex justify-between items-start">
            <div>
              <p className="font-semibold text-sm">{diagnosticResults.error ? "Erreur Diagnostic:" : "Résultats Diagnostic:"}</p>
              <p className="text-xs">{diagnosticResults.error || diagnosticResults.message}</p>
            </div>
            <button 
              onClick={() => setDiagnosticResults(null)} 
              className="text-text-secondary hover:text-text-primary p-1 -m-1 rounded-md"
            >
              <FaTimes />
            </button>
          </div>
          
          {diagnosticResults.data && diagnosticResults.data.idMappings && (
            <div className="mt-2">
              <p className="font-medium text-xs mb-1">
                Mappings d'IDs: {diagnosticResults.data.mappingCount || 0}
              </p>
              
              {diagnosticResults.data.mappingCount > 0 ? (
                <div className="max-h-40 overflow-y-auto bg-ui-background/50 p-2 rounded-md border border-ui-border text-xs">
                  <table className="w-full">
                    <thead className="text-text-secondary">
                      <tr className="border-b border-ui-border/50">
                        <th className="text-left p-1 font-medium">ID Interface</th>
                        <th className="text-left p-1 font-medium">ID Blockchain</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ui-border/30">
                      {Object.entries(diagnosticResults.data.idMappings).map(([uiId, blockchainId]: [string, any]) => (
                        <tr key={uiId}>
                          <td className="p-1 font-mono">{uiId}</td>
                          <td className="p-1 font-mono">{blockchainId}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="italic text-xs text-text-tertiary">Aucun mapping trouvé.</p>
              )}
            </div>
          )}
        </div>
      )}
      
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <div className="p-4 rounded-lg bg-ui-background/50 border border-ui-border">
            <h3 className="text-md font-semibold text-text-primary mb-4">Nouvelle Notification</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label htmlFor="notifTitleForm" className="block text-xs font-medium text-text-secondary mb-1">Titre</label>
                <input id="notifTitleForm" type="text" className={`w-full rounded-md bg-ui-background border text-text-primary focus:border-brand-blue focus:ring-1 focus:ring-brand-blue py-1.5 px-2 text-sm shadow-sm ${formErrors.title ? 'border-red-500' : 'border-ui-border'}`} value={newNotification.title} onChange={e => setNewNotification({...newNotification, title: e.target.value})} placeholder="Titre" />
                {formErrors.title && <p className="text-red-500 text-xs mt-1">{formErrors.title}</p>}
              </div>
              <div>
                <label htmlFor="notifMessageForm" className="block text-xs font-medium text-text-secondary mb-1">Message</label>
                <textarea id="notifMessageForm" className={`w-full rounded-md bg-ui-background border text-text-primary focus:border-brand-blue focus:ring-1 focus:ring-brand-blue py-1.5 px-2 text-sm shadow-sm min-h-[70px] ${formErrors.message ? 'border-red-500' : 'border-ui-border'}`} value={newNotification.message} onChange={e => setNewNotification({...newNotification, message: e.target.value})} placeholder="Message" />
                {formErrors.message && <p className="text-red-500 text-xs mt-1">{formErrors.message}</p>}
              </div>
              <div>
                <label htmlFor="notifTypeForm" className="block text-xs font-medium text-text-secondary mb-1">Type</label>
                <select id="notifTypeForm" className="w-full rounded-md bg-ui-background border-ui-border text-text-primary focus:border-brand-blue focus:ring-1 focus:ring-brand-blue py-1.5 px-2 text-sm shadow-sm" value={newNotification.type} onChange={e => setNewNotification({...newNotification, type: e.target.value})}>
                  <option value="info">Info</option> <option value="warning">Alerte</option> <option value="error">Erreur</option> <option value="success">Succès</option>
                </select>
              </div>
              <div>
                <label htmlFor="notifTargetTypeForm" className="block text-xs font-medium text-text-secondary mb-1">Destinataire</label>
                <select id="notifTargetTypeForm" className="w-full rounded-md bg-ui-background border-ui-border text-text-primary focus:border-brand-blue focus:ring-1 focus:ring-brand-blue py-1.5 px-2 text-sm shadow-sm mb-1.5" value={newNotification.targetType} onChange={e => setNewNotification({...newNotification, targetType: e.target.value, targetValue: ""})}>
                  <option value="all">Tous</option> <option value="role">Rôle</option> <option value="user">Utilisateur</option>
                </select>
                {newNotification.targetType !== "all" && (
                  <input type="text" className={`w-full rounded-md bg-ui-background border text-text-primary focus:border-brand-blue focus:ring-1 focus:ring-brand-blue py-1.5 px-2 text-sm shadow-sm ${formErrors.targetValue ? 'border-red-500' : 'border-ui-border'}`} value={newNotification.targetValue} onChange={e => setNewNotification({...newNotification, targetValue: e.target.value})} placeholder={newNotification.targetType === "role" ? "Nom du rôle" : "ID Utilisateur"} />
                )}
                {formErrors.targetValue && <p className="text-red-500 text-xs mt-1">{formErrors.targetValue}</p>}
              </div>
              <div className="pt-1">
                <Button type="submit" variant="primary" size="sm" className="w-full bg-brand-blue hover:bg-brand-blue-dark text-white" disabled={actionFetcher.state === "submitting"}>
                  {actionFetcher.state === "submitting" ? <><FaSync className="animate-spin mr-1.5 h-3.5 w-3.5" /> Envoi...</> : <><FaPaperPlane className="mr-1.5 h-3.5 w-3.5" /> Envoyer</>}
                </Button>
              </div>
            </form>
          </div>
        </div>
        
        <div className="lg:col-span-2">
          <div className="p-4 rounded-lg bg-ui-background/50 border border-ui-border">
            <h3 className="text-md font-semibold text-text-primary mb-3">Historique des Notifications</h3>
            {loading ? ( <div className="flex justify-center items-center h-60"><FaSync className="text-brand-blue animate-spin text-2xl" /></div>
            ) : notifications.length === 0 ? ( <div className="text-center py-10 text-text-secondary"><FaBell className="mx-auto text-3xl mb-2 opacity-40" /><p>Aucune notification.</p></div>
            ) : (
              <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
                {notifications.map((notification) => (
                  <div key={notification.id} className={`p-2.5 rounded-md border transition-colors cursor-pointer ${notification.isRead ? 'bg-ui-background/30 border-ui-border/50 hover:border-ui-border' : 'bg-ui-background/70 border-ui-border hover:border-brand-blue/50'}`} onClick={() => setSelectedNotification(selectedNotification?.id === notification.id ? null : notification)}>
                    <div className="flex items-start gap-2">
                      <div className="pt-0.5">{getTypeIcon(notification.type)}</div>
                      <div className="flex-grow min-w-0">
                        <div className="flex justify-between items-start mb-0.5">
                          <h4 className={`font-medium text-sm ${notification.isRead ? 'text-text-secondary' : 'text-text-primary'}`}>{notification.title}</h4>
                          {!notification.isRead && ( <Button variant="link" size="sm" className="text-xs text-brand-blue-light hover:underline p-0 h-auto" onClick={(e) => { e.stopPropagation(); markAsRead(notification.id); }}><FaEye size={10} className="mr-1" />Lue</Button> )}
                        </div>
                        <p className={`text-xs ${notification.isRead ? 'text-text-tertiary' : 'text-text-secondary'}`}>{notification.message}</p>
                        <div className="flex justify-between items-center mt-1.5 text-xs text-text-tertiary">
                          <div className="flex items-center gap-1.5"><span>{formatDate(notification.createdAt)}</span><span className="flex items-center gap-0.5">{getTargetIcon(notification.userId)}</span></div>
                          <div className="flex items-center gap-1.5">
                            {notification.isRead ? <span className="flex items-center gap-1"><FaEye size={10} />Lu</span> : <span className="flex items-center gap-1 opacity-70"><FaEyeSlash size={10} />Non lu</span>}
                            <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-500/10 h-6 w-6 p-0.5" onClick={(e) => { e.stopPropagation(); deleteNotification(notification.id); }} title="Supprimer"><FaTrash size={10} /></Button>
                          </div>
                        </div>
                        {selectedNotification?.id === notification.id && (
                          <div className="mt-1.5 pt-1.5 border-t border-ui-border/50 text-xs text-text-secondary space-y-0.5">
                            <div><span className="font-medium">Cible:</span> {getTargetText(notification.userId)}</div>
                            <div><span className="font-medium">ID:</span> {notification.id}</div>
                            {notification.operator && <div><span className="font-medium">Opérateur:</span> {notification.operator}</div>}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="mt-6 p-4 rounded-lg bg-ui-background/50 border border-ui-border">
        <h3 className="text-md font-semibold text-text-primary mb-1.5">À propos des notifications</h3>
        <p className="text-xs text-text-secondary">
          Les notifications sont stockées sur la blockchain et sont accessibles à tous les utilisateurs de la plateforme.
          Elles permettent d'informer les utilisateurs des événements importants, des mises à jour système, ou de messages spécifiques.
        </p>
      </div>
    </div>
  );
}
