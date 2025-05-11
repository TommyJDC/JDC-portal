import React, { useState, useEffect } from "react";
import { useFetcher } from "@remix-run/react";
import { Button } from "./ui/Button";
import { 
  FaBell, FaEnvelope, FaExclamationTriangle, 
  FaInfoCircle, FaCheckCircle, FaTrash,
  FaEye, FaEyeSlash, FaUsers, FaUser, FaUserTag,
  FaSync, FaPaperPlane, FaPlusCircle
} from "react-icons/fa";

// Types pour les notifications
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

// Type pour la réponse de l'API de création/mise à jour
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
  
  // Données pour le formulaire de création
  const [newNotification, setNewNotification] = useState({
    title: "",
    message: "",
    type: "info",
    targetType: "all", // all, role, user
    targetValue: "" // ID utilisateur ou nom du rôle
  });
  
  // Fetcher pour récupérer et gérer les notifications
  const notificationsFetcher = useFetcher<{notifications: Notification[], error?: string}>();
  const actionFetcher = useFetcher<NotificationActionResponse>();
  
  // État pour stocker les IDs de notifications créées avec notre nouvelle API
  const [directNotificationIds, setDirectNotificationIds] = useState<string[]>([]);
  
  // Après une action réussie sur les notifications directes
  const directNotificationFetcher = useFetcher<NotificationActionResponse>();
  
  // État pour les résultats du diagnostic
  const [diagnosticResults, setDiagnosticResults] = useState<any>(null);
  const [runningDiagnostic, setRunningDiagnostic] = useState(false);
  const diagnosticFetcher = useFetcher<{success?: boolean, message?: string, data?: any, error?: string}>();
  
  // Charger les notifications au premier rendu
  useEffect(() => {
    fetchNotifications();
  }, []);
  
  // Fonction pour récupérer les notifications
  const fetchNotifications = () => {
    setLoading(true);
    // Ajouter le paramètre dev_bypass en développement
    const devParam = import.meta.env.DEV ? "?dev_bypass=true" : "";
    notificationsFetcher.load(`/api/admin/notifications${devParam}`);
  };
  
  // Mettre à jour les notifications quand la requête est terminée
  useEffect(() => {
    if (notificationsFetcher.data) {
      setNotifications(notificationsFetcher.data.notifications || []);
      setLoading(false);
    }
  }, [notificationsFetcher.data]);
  
  // Surveiller les réponses du fetcher pour les notifications directes
  useEffect(() => {
    if (directNotificationFetcher.data?.success && directNotificationFetcher.data?.id) {
      // Ajouter l'ID à notre liste pour pouvoir le supprimer plus tard
      const notificationId = directNotificationFetcher.data.id;
      setDirectNotificationIds(prev => [...prev, notificationId]);
      console.log(`[NotificationPanel] Notification directe créée avec ID: ${notificationId}`);
      
      // Rafraîchir la liste après création
      setTimeout(fetchNotifications, 1000);
    }
  }, [directNotificationFetcher.data]);
  
  // Après une action réussie, actualiser les notifications
  useEffect(() => {
    if (actionFetcher.data?.success) {
      console.log('[NotificationPanel] Action réussie:', actionFetcher.data?.message);
      fetchNotifications();
      
      // Réinitialiser le formulaire si c'était une création
      if (actionFetcher.data.id) {
        setNewNotification({
          title: "",
          message: "",
          type: "info",
          targetType: "all",
          targetValue: ""
        });
      }
    } else if (actionFetcher.data?.error) {
      console.error('[NotificationPanel] Erreur:', actionFetcher.data.error);
      // Rafraîchir quand même pour être sûr d'avoir les données à jour
      setTimeout(fetchNotifications, 1000);
    }
  }, [actionFetcher.data]);
  
  // Validation du formulaire
  const validateForm = () => {
    const errors: Record<string, string> = {};
    
    if (!newNotification.title.trim()) {
      errors.title = "Le titre est requis";
    }
    
    if (!newNotification.message.trim()) {
      errors.message = "Le message est requis";
    }
    
    if (newNotification.targetType !== "all" && !newNotification.targetValue.trim()) {
      errors.targetValue = "Ce champ est requis";
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  // Gérer la soumission du formulaire
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    // Déterminer le userId basé sur le type de cible
    let userId = "";
    if (newNotification.targetType === "role") {
      userId = `role:${newNotification.targetValue}`;
    } else if (newNotification.targetType === "user") {
      userId = newNotification.targetValue;
    }
    // targetType === "all" reste vide (tous les utilisateurs)
    
    // Créer le paramètre dev_bypass si nécessaire
    const devParam = import.meta.env.DEV ? "?dev_bypass=true" : "";
    
    // Envoyer la requête pour créer la notification
    actionFetcher.submit(
      {
        action: "create",
        title: newNotification.title,
        message: newNotification.message,
        type: newNotification.type,
        userId
      },
      {
        method: "post",
        action: `/api/admin/notifications${devParam}`
      }
    );
  };
  
  // Marquer une notification comme lue
  const markAsRead = (id: string) => {
    // Créer le paramètre dev_bypass si nécessaire
    const devParam = import.meta.env.DEV ? "?dev_bypass=true" : "";
    
    // Envoyer la requête pour marquer comme lue
    actionFetcher.submit(
      {
        action: "markAsRead",
        id
      },
      {
        method: "post",
        action: `/api/admin/notifications${devParam}`
      }
    );
  };
  
  // Formater la date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };
  
  // Récupérer l'icône en fonction du type
  const getTypeIcon = (type: string) => {
    switch (type) {
      case "info":
        return <FaInfoCircle className="text-blue-500" />;
      case "warning":
        return <FaExclamationTriangle className="text-yellow-500" />;
      case "error":
        return <FaExclamationTriangle className="text-red-500" />;
      case "success":
        return <FaCheckCircle className="text-green-500" />;
      default:
        return <FaBell className="text-jdc-gray-400" />;
    }
  };
  
  // Afficher l'icône de la cible (tout le monde, rôle, utilisateur spécifique)
  const getTargetIcon = (userId: string) => {
    if (!userId || userId === "all") {
      return <FaUsers className="text-jdc-gray-400" title="Tous les utilisateurs" />;
    }
    
    if (userId.startsWith("role:")) {
      return <FaUserTag className="text-jdc-gray-400" title={`Rôle: ${userId.substring(5)}`} />;
    }
    
    return <FaUser className="text-jdc-gray-400" title={`Utilisateur: ${userId}`} />;
  };
  
  // Afficher un texte pour la cible
  const getTargetText = (userId: string) => {
    if (!userId || userId === "all") {
      return "Tous les utilisateurs";
    }
    
    if (userId.startsWith("role:")) {
      return `Rôle: ${userId.substring(5)}`;
    }
    
    return `Utilisateur: ${userId}`;
  };
  
  const testCreateNotification = () => {
    // Créer une notification de test
    actionFetcher.submit(
      {
        action: "create",
        title: "Notification de test " + new Date().toLocaleTimeString(),
        message: "Ceci est une notification de test créée le " + new Date().toLocaleString(),
        type: "info",
        targetType: "all",
        targetValue: "",
        userId: "" // Assurer que userId est explicitement vide pour tous
      },
      {
        method: "post",
        action: `/api/admin/notifications${import.meta.env.DEV ? "?dev_bypass=true" : ""}`
      }
    );
    
    // Après avoir soumis la notification, rafraîchir la liste après un court délai
    setTimeout(() => {
      console.log("Rafraîchissement des notifications...");
      fetchNotifications();
    }, 3000);
  };
  
  // Fonction pour créer une notification avec un ID explicite
  const createDirectNotification = () => {
    // Générer un ID unique facilement reconnaissable
    const notifId = `direct_${Date.now().toString(36)}`;
    
    // Afficher l'ID dans la console pour référence
    console.log(`[NotificationPanel] Création d'une notification avec ID explicite: ${notifId}`);
    
    directNotificationFetcher.submit(
      {
        action: "create",
        notificationId: notifId,
        title: `Notification directe ${new Date().toLocaleTimeString()}`,
        message: `Cette notification a été créée avec un ID explicite (${notifId}) et peut être supprimée.`,
        type: "info",
        userId: "all"
      },
      {
        method: "post",
        action: `/api/direct-notifications${import.meta.env.DEV ? "?dev_bypass=true" : ""}`
      }
    );
  };
  
  // Fonction pour supprimer une notification
  const deleteNotification = (id: string): void => {
    if (!id) return;
    
    // Si l'ID est dans notre liste de notifications directes, utiliser l'API directe
    if (directNotificationIds.includes(id)) {
      deleteDirectNotification(id);
      return;
    }
    
    console.log(`[NotificationPanel] Tentative de suppression de la notification: ${id}`);
    
    // Ajouter le paramètre dev_bypass en développement
    const devParam = import.meta.env.DEV ? "?dev_bypass=true" : "";
    
    actionFetcher.submit(
      {
        action: "delete",
        id
      },
      {
        method: "post",
        action: `/api/admin/notifications${devParam}`
      }
    );
  };
  
  // Fonction pour supprimer une notification directe
  const deleteDirectNotification = (id: string): void => {
    // Vérifier si l'ID est dans notre liste de notifications directes
    if (!directNotificationIds.includes(id)) {
      console.log(`[NotificationPanel] L'ID ${id} n'est pas une notification directe, tentative de suppression normale`);
      deleteNotification(id);
      return;
    }
    
    console.log(`[NotificationPanel] Suppression d'une notification directe avec ID: ${id}`);
    
    directNotificationFetcher.submit(
      {
        action: "delete",
        id
      },
      {
        method: "post",
        action: `/api/direct-notifications${import.meta.env.DEV ? "?dev_bypass=true" : ""}`
      }
    );
    
    // Retirer l'ID de notre liste
    setDirectNotificationIds(prev => prev.filter(item => item !== id));
    
    // Rafraîchir la liste après suppression
    setTimeout(fetchNotifications, 1000);
  };
  
  // Fonction pour exécuter le diagnostic des notifications
  const runNotificationsDiagnostic = () => {
    setRunningDiagnostic(true);
    diagnosticFetcher.load(`/api/notifications/diagnostics${import.meta.env.DEV ? "?dev_bypass=true" : ""}`);
  };
  
  // Surveiller les résultats du diagnostic
  useEffect(() => {
    if (diagnosticFetcher.data) {
      setRunningDiagnostic(false);
      setDiagnosticResults(diagnosticFetcher.data);
    }
  }, [diagnosticFetcher.data]);
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Gestion des Notifications</h2>
        <div className="flex gap-2">
          <Button 
            onClick={fetchNotifications} 
            variant="outline" 
            disabled={loading}
          >
            {loading ? <FaSync className="mr-2 animate-spin" /> : null}
            {loading ? "Chargement..." : "Rafraîchir"}
          </Button>
          <Button 
            onClick={testCreateNotification}
            variant="primary"
          >
            <FaPlusCircle className="mr-2" />
            Créer notification test
          </Button>
          
          {/* Nouveau bouton pour les notifications directes */}
          <Button 
            onClick={createDirectNotification}
            variant="primary"
            disabled={directNotificationFetcher.state === "submitting"}
          >
            <FaPlusCircle className="mr-2" />
            {directNotificationFetcher.state === "submitting" ? "Création..." : "Notification supprimable"}
          </Button>
          
          {/* Bouton pour le diagnostic des notifications */}
          <Button 
            onClick={runNotificationsDiagnostic}
            variant="secondary"
            disabled={runningDiagnostic}
          >
            {runningDiagnostic ? <FaSync className="mr-2 animate-spin" /> : <FaInfoCircle className="mr-2" />}
            {runningDiagnostic ? "Analyse..." : "Diagnostiquer IDs"}
          </Button>
        </div>
      </div>
      
      {/* Message d'erreur */}
      {notificationsFetcher.data?.error && (
        <div className="p-4 rounded-lg bg-red-900/20 border border-red-800 text-white mb-4">
          <p className="font-bold">Erreur:</p>
          <p>{notificationsFetcher.data.error}</p>
          <Button onClick={fetchNotifications} className="mt-2" variant="secondary" size="sm">
            Réessayer
          </Button>
        </div>
      )}
      
      {/* Erreur lors d'une action */}
      {actionFetcher.data?.error && (
        <div className="p-4 rounded-lg bg-red-900/20 border border-red-800 text-white mb-4">
          <p className="font-bold">Erreur lors de l'action:</p>
          <p>{actionFetcher.data.error}</p>
        </div>
      )}
      
      {/* Succès lors d'une action */}
      {actionFetcher.data?.success && (
        <div className="p-4 rounded-lg bg-green-900/20 border border-green-800 text-white mb-4">
          <p className="font-bold">Succès:</p>
          <p>{actionFetcher.data.message}</p>
        </div>
      )}
      
      {/* Résultats du diagnostic */}
      {diagnosticResults && (
        <div className={`p-4 rounded-lg border mb-4 ${
          diagnosticResults.error 
            ? 'bg-red-900/20 border-red-800' 
            : 'bg-jdc-blue-900/20 border-jdc-blue-800'
        } text-white`}>
          <div className="flex justify-between items-start">
            <div>
              <p className="font-bold">{diagnosticResults.error ? "Erreur de diagnostic:" : "Résultats du diagnostic:"}</p>
              <p>{diagnosticResults.error || diagnosticResults.message}</p>
            </div>
            <button 
              onClick={() => setDiagnosticResults(null)} 
              className="text-white hover:text-jdc-gray-400"
            >
              ×
            </button>
          </div>
          
          {diagnosticResults.data && diagnosticResults.data.idMappings && (
            <div className="mt-3">
              <p className="font-semibold mb-2">
                Mappings d'IDs trouvés: {diagnosticResults.data.mappingCount || 0}
              </p>
              
              {diagnosticResults.data.mappingCount > 0 ? (
                <div className="max-h-60 overflow-y-auto bg-jdc-gray-900/50 p-2 rounded">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-jdc-gray-700">
                        <th className="text-left p-1">ID Interface</th>
                        <th className="text-left p-1">ID Blockchain</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(diagnosticResults.data.idMappings).map(([uiId, blockchainId]: [string, any]) => (
                        <tr key={uiId} className="border-b border-jdc-gray-800/50">
                          <td className="p-1 font-mono text-xs">{uiId}</td>
                          <td className="p-1 font-mono text-xs">{blockchainId}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="italic text-sm">Aucun mapping trouvé, cela peut indiquer que les IDs sont déjà corrects ou qu'il y a un problème de synchronisation.</p>
              )}
            </div>
          )}
        </div>
      )}
      
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Formulaire de création */}
        <div className="lg:col-span-1">
          <div className="p-4 rounded-lg bg-jdc-gray-800/70 border border-jdc-gray-700">
            <h3 className="text-lg font-semibold mb-4">Nouvelle Notification</h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-jdc-gray-400 mb-1">Titre</label>
                <input
                  type="text"
                  className={`w-full bg-jdc-gray-900 text-white border ${formErrors.title ? 'border-red-500' : 'border-jdc-gray-700'} rounded px-3 py-2`}
                  value={newNotification.title}
                  onChange={e => setNewNotification({...newNotification, title: e.target.value})}
                  placeholder="Titre de la notification"
                />
                {formErrors.title && <p className="text-red-500 text-xs mt-1">{formErrors.title}</p>}
              </div>
              
              <div>
                <label className="block text-sm text-jdc-gray-400 mb-1">Message</label>
                <textarea
                  className={`w-full bg-jdc-gray-900 text-white border ${formErrors.message ? 'border-red-500' : 'border-jdc-gray-700'} rounded px-3 py-2 min-h-[100px]`}
                  value={newNotification.message}
                  onChange={e => setNewNotification({...newNotification, message: e.target.value})}
                  placeholder="Contenu du message"
                />
                {formErrors.message && <p className="text-red-500 text-xs mt-1">{formErrors.message}</p>}
              </div>
              
              <div>
                <label className="block text-sm text-jdc-gray-400 mb-1">Type</label>
                <select
                  className="w-full bg-jdc-gray-900 text-white border border-jdc-gray-700 rounded px-3 py-2"
                  value={newNotification.type}
                  onChange={e => setNewNotification({...newNotification, type: e.target.value})}
                >
                  <option value="info">Information</option>
                  <option value="warning">Avertissement</option>
                  <option value="error">Erreur</option>
                  <option value="success">Succès</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm text-jdc-gray-400 mb-1">Destinataire</label>
                <select
                  className="w-full bg-jdc-gray-900 text-white border border-jdc-gray-700 rounded px-3 py-2 mb-2"
                  value={newNotification.targetType}
                  onChange={e => setNewNotification({...newNotification, targetType: e.target.value, targetValue: ""})}
                >
                  <option value="all">Tous les utilisateurs</option>
                  <option value="role">Par rôle</option>
                  <option value="user">Utilisateur spécifique</option>
                </select>
                
                {newNotification.targetType !== "all" && (
                  <div>
                    <input
                      type="text"
                      className={`w-full bg-jdc-gray-900 text-white border ${formErrors.targetValue ? 'border-red-500' : 'border-jdc-gray-700'} rounded px-3 py-2`}
                      value={newNotification.targetValue}
                      onChange={e => setNewNotification({...newNotification, targetValue: e.target.value})}
                      placeholder={newNotification.targetType === "role" ? "Nom du rôle (Admin, Technician...)" : "ID de l'utilisateur"}
                    />
                    {formErrors.targetValue && <p className="text-red-500 text-xs mt-1">{formErrors.targetValue}</p>}
                  </div>
                )}
              </div>
              
              <div className="pt-2">
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={actionFetcher.state === "submitting"}
                >
                  {actionFetcher.state === "submitting" ? (
                    <>
                      <FaSync className="animate-spin mr-2" /> Envoi en cours...
                    </>
                  ) : (
                    <>
                      <FaPaperPlane className="mr-2" /> Envoyer la notification
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
        
        {/* Liste des notifications */}
        <div className="lg:col-span-2">
          <div className="p-4 rounded-lg bg-jdc-gray-800/70 border border-jdc-gray-700">
            <h3 className="text-lg font-semibold mb-4">Historique des Notifications</h3>
            
            {loading ? (
              <div className="flex justify-center items-center h-60">
                <FaSync className="text-jdc-gray-400 animate-spin text-2xl" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-10 text-jdc-gray-400">
                <FaBell className="mx-auto text-4xl mb-3 opacity-30" />
                <p>Aucune notification trouvée</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                {notifications.map((notification) => (
                  <div 
                    key={notification.id} 
                    className={`p-3 rounded-lg border ${
                      notification.isRead ? 'bg-jdc-gray-900/50 border-jdc-gray-800' : 'bg-jdc-gray-800 border-jdc-gray-700'
                    } hover:border-jdc-blue/50 transition-colors cursor-pointer`}
                    onClick={() => setSelectedNotification(
                      selectedNotification?.id === notification.id ? null : notification
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="pt-1">
                        {getTypeIcon(notification.type)}
                      </div>
                      <div className="flex-grow">
                        <div className="flex justify-between items-start mb-1">
                          <h4 className={`font-medium ${notification.isRead ? 'text-jdc-gray-300' : 'text-white'}`}>
                            {notification.title}
                          </h4>
                          <div className="flex gap-2">
                            {!notification.isRead && (
                              <button 
                                className="text-xs px-2 py-0.5 rounded bg-jdc-blue/20 text-jdc-blue"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markAsRead(notification.id);
                                }}
                              >
                                <FaEye size={10} className="mr-1" />
                                Marquer comme lue
                              </button>
                            )}
                          </div>
                        </div>
                        
                        <p className={`text-sm ${notification.isRead ? 'text-jdc-gray-400' : 'text-jdc-gray-300'}`}>
                          {notification.message}
                        </p>
                        
                        <div className="flex justify-between items-center mt-2 text-xs text-jdc-gray-500">
                          <div className="flex items-center gap-2">
                            <span>{formatDate(notification.createdAt)}</span>
                            <span className="flex items-center gap-1">
                              {getTargetIcon(notification.userId)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {notification.isRead ? (
                              <span className="flex items-center gap-1">
                                <FaEye size={10} /> Lu
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <FaEyeSlash size={10} /> Non lu
                              </span>
                            )}
                            
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteNotification(notification.id);
                              }}
                              className="text-red-400 hover:text-red-600 ml-2"
                              title="Supprimer cette notification"
                            >
                              <FaTrash size={10} />
                            </button>
                          </div>
                        </div>
                        
                        {selectedNotification?.id === notification.id && (
                          <div className="mt-3 pt-3 border-t border-jdc-gray-700">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-jdc-gray-400">
                              <div>
                                <span className="font-semibold">Cible: </span>
                                {getTargetText(notification.userId)}
                              </div>
                              <div>
                                <span className="font-semibold">ID: </span>
                                {notification.id}
                              </div>
                              <div>
                                <span className="font-semibold">Date: </span>
                                {formatDate(notification.createdAt)}
                              </div>
                              <div>
                                <span className="font-semibold">Type: </span>
                                {notification.type}
                              </div>
                              {notification.operator && (
                                <div>
                                  <span className="font-semibold">Opérateur: </span>
                                  {notification.operator}
                                </div>
                              )}
                            </div>
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
      
      <div className="mt-6 p-4 rounded-lg bg-jdc-gray-800/70 border border-jdc-gray-700">
        <h3 className="text-lg font-semibold mb-2">À propos des notifications</h3>
        <p className="text-sm text-jdc-gray-300">
          Les notifications sont stockées sur la blockchain et sont accessibles à tous les utilisateurs de la plateforme.
          Elles permettent d'informer les utilisateurs des événements importants, des mises à jour système, ou de messages spécifiques.
          Les notifications peuvent être ciblées vers tous les utilisateurs, un rôle spécifique, ou un utilisateur particulier.
        </p>
      </div>
    </div>
  );
} 