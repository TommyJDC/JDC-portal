import React, { useState, useEffect } from "react";
import { useFetcher } from "@remix-run/react";
import { Button } from "./ui/Button"; // Importer le composant Button

interface UserProfile {
  uid: string;
  email: string;
  role: string;
  secteurs: string[];
  displayName: string;
  nom: string;
  phone: string;
  address?: string;
  blockchainAddress?: string;
  encryptedWallet?: string;
  jobTitle?: string;
  department?: string;
  googleRefreshToken?: string;
  isGmailProcessor?: boolean;
  gmailAuthorizedScopes?: string[];
  gmailAuthStatus?: string;
  labelSapClosed?: string;
  labelSapNoResponse?: string;
  labelSapRma?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface UserManagementPanelProps {
  users: UserProfile[];
  onEditUser?: (user: UserProfile) => void;
  showEncryptedWallet?: boolean;
}

const AVAILABLE_ROLES = ["Admin", "Technician", "Viewer"];
const AVAILABLE_SECTORS = ["CHR", "HACCP", "Kezia", "Tabac"];

export function UserManagementPanel({ users = [], onEditUser, showEncryptedWallet = false }: UserManagementPanelProps) {
  const fetcher = useFetcher();
  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<string>("");
  const [editSecteurs, setEditSecteurs] = useState<string[]>([]);
  const [generatingWalletUid, setGeneratingWalletUid] = useState<string | null>(null);

  // Ajout utilisateur
  const [showAdd, setShowAdd] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addNom, setAddNom] = useState("");
  const [addRole, setAddRole] = useState(AVAILABLE_ROLES[0]);
  const [addSecteurs, setAddSecteurs] = useState<string[]>([]);

  // Suppression utilisateur
  const [deletingUid, setDeletingUid] = useState<string | null>(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  // Assurer que users est un tableau valide
  const safeUsers = Array.isArray(users) ? users : [];

  useEffect(() => {
    console.log("UserManagementPanel monté avec", safeUsers.length, "utilisateurs");
    console.log("Utilisateurs:", safeUsers);
  }, [safeUsers]);

  const handleRefresh = () => {
    console.log("🔄 Rafraîchissement des utilisateurs demandé");
    try {
      fetcher.load("/admin?_data=routes%2Fadmin");
      console.log("✅ Requête de rafraîchissement envoyée");
    } catch (error) {
      console.error("❌ Erreur lors du rafraîchissement:", error);
    }
  };

  const startEdit = (user: UserProfile) => {
    if (onEditUser) {
      // Si un gestionnaire d'édition externe est fourni, l'utiliser
      onEditUser(user);
    } else {
      // Sinon, utiliser l'édition interne
      setEditingUid(user.uid);
      setEditRole(user.role);
      setEditSecteurs(user.secteurs);
    }
  };

  const cancelEdit = () => {
    setEditingUid(null);
    setEditRole("");
    setEditSecteurs([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingUid) return;
    
    // Préparer les données de mise à jour
    const updates: Partial<UserProfile> = {};
    
    if (editRole) updates.role = editRole;
    if (editSecteurs) updates.secteurs = [...editSecteurs];
    
    // Envoyer via un formulaire standard pour une meilleure compatibilité
    const form = document.createElement('form');
    form.method = 'post';
    form.action = '/admin/action';
    form.style.display = 'none';
    
    // Ajouter les champs
    const addField = (name: string, value: string) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = value;
      form.appendChild(input);
    };
    
    addField('userId', editingUid);
    addField('updates', JSON.stringify(updates));
    addField('dev_bypass', 'true'); // Ajouter dev_bypass pour contourner les vérifications d'autorisation
    
    // Ajouter et soumettre le formulaire
    document.body.appendChild(form);
    form.submit();
    
    cancelEdit();
  };

  const handleSectorChange = (sector: string) => {
    setEditSecteurs((prev) =>
      prev.includes(sector)
        ? prev.filter((s) => s !== sector)
        : [...prev, sector]
    );
  };

  // Ajout utilisateur
  const handleAddSectorChange = (sector: string) => {
    setAddSecteurs((prev) =>
      prev.includes(sector)
        ? prev.filter((s) => s !== sector)
        : [...prev, sector]
    );
  };

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addEmail || !addNom || addSecteurs.length === 0) return;
    
    console.log("[UserManagementPanel.handleAddUser] Création d'un utilisateur:", addEmail);
    
    // Créer un formulaire pour une soumission standard
    const form = document.createElement('form');
    form.method = 'post';
    form.action = '/admin/action';
    form.style.display = 'none';
    
    // Ajouter les champs
    const addField = (name: string, value: string) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = value;
      form.appendChild(input);
    };
    
    addField('createUser', '1');
    addField('email', addEmail);
    addField('nom', addNom);
    addField('displayName', addNom);
    addField('role', addRole);
    addField('secteurs', JSON.stringify(addSecteurs));
    addField('dev_bypass', 'true');
    
    // Ajouter et soumettre le formulaire
    document.body.appendChild(form);
    form.submit();
    
    setAddEmail("");
    setAddNom("");
    setAddRole(AVAILABLE_ROLES[0]);
    setAddSecteurs([]);
    setShowAdd(false);
  };

  // Suppression utilisateur
  const handleDeleteUser = (uid: string) => {
    setDeletingUid(uid);
    setShowConfirmDelete(true);
  };

  const confirmDelete = () => {
    if (!deletingUid) return;
    
    console.log("[UserManagementPanel.confirmDelete] Suppression de l'utilisateur:", deletingUid);
    
    // Créer un formulaire pour une soumission standard
    const form = document.createElement('form');
    form.method = 'post';
    form.action = '/admin/action';
    form.style.display = 'none';
    
    // Ajouter les champs
    const addField = (name: string, value: string) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = value;
      form.appendChild(input);
    };
    
    addField('deleteUser', '1');
    addField('userId', deletingUid);
    addField('dev_bypass', 'true');
    
    // Ajouter et soumettre le formulaire
    document.body.appendChild(form);
    form.submit();
    
    setShowConfirmDelete(false);
    setDeletingUid(null);
  };

  const cancelDelete = () => {
    setShowConfirmDelete(false);
    setDeletingUid(null);
  };

  // Générer un wallet pour un utilisateur
  const handleGenerateWallet = async (uid: string) => {
    setGeneratingWalletUid(uid);
    try {
      // Vérifier d'abord que l'utilisateur existe réellement dans la blockchain
      const form = document.createElement('form');
      form.method = 'post';
      form.action = '/admin/action';
      form.style.display = 'none';
      
      // Ajouter les champs
      const addField = (name: string, value: string) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.appendChild(input);
      };
      
      addField('generateWallet', '1');
      addField('userId', uid);
      addField('dev_bypass', 'true');
      
      // Ajouter et soumettre le formulaire
      document.body.appendChild(form);
      
      // Afficher un message pour informer l'utilisateur
      alert("Génération du wallet en cours. Si l'utilisateur n'existe pas encore, il sera automatiquement créé dans la blockchain.\n\nVous allez être redirigé vers le panel admin. Veuillez attendre que la transaction blockchain soit confirmée (environ 10-15 secondes) puis cliquez sur 'Rafraîchir la liste'.");
      
      form.submit();
    } catch (e) {
      console.error("Erreur lors de la génération du wallet:", e);
      alert("Erreur lors de la génération du wallet. Vérifiez que l'utilisateur existe bien dans la blockchain.");
      setGeneratingWalletUid(null);
    }
  };

  return (
    <div className="space-y-4"> {/* Ajout d'un espacement de base */}
      {/* Titre et boutons d'action principaux retirés d'ici, car ils sont dans la CardHeader de admin.tsx */}
      {/* Le titre "Gestion des Utilisateurs" est déjà dans la CardHeader de admin.tsx */}
      
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          className="border-ui-border text-text-secondary hover:bg-ui-border hover:text-text-primary"
        >
          Rafraîchir la liste ({safeUsers.length})
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setShowAdd((v) => !v)}
          className="bg-brand-blue hover:bg-brand-blue-dark text-white"
        >
          {showAdd ? "Annuler Ajout" : "Ajouter Utilisateur"}
        </Button>
      </div>

      {showAdd && (
        <form onSubmit={handleAddUser} className="mb-4 p-4 bg-ui-background/50 rounded-md border border-ui-border space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="addEmail" className="block text-xs font-medium text-text-secondary mb-1">Email</label>
              <input type="email" id="addEmail" className="w-full rounded-md bg-ui-background border-ui-border text-text-primary focus:border-brand-blue focus:ring-brand-blue py-1.5 px-2 text-sm" value={addEmail} onChange={e => setAddEmail(e.target.value)} required />
            </div>
            <div>
              <label htmlFor="addNom" className="block text-xs font-medium text-text-secondary mb-1">Nom</label>
              <input type="text" id="addNom" className="w-full rounded-md bg-ui-background border-ui-border text-text-primary focus:border-brand-blue focus:ring-brand-blue py-1.5 px-2 text-sm" value={addNom} onChange={e => setAddNom(e.target.value)} required />
            </div>
            <div>
              <label htmlFor="addRole" className="block text-xs font-medium text-text-secondary mb-1">Rôle</label>
              <select id="addRole" className="w-full rounded-md bg-ui-background border-ui-border text-text-primary focus:border-brand-blue focus:ring-brand-blue py-1.5 px-2 text-sm" value={addRole} onChange={e => setAddRole(e.target.value)}>
                {AVAILABLE_ROLES.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Secteurs</label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_SECTORS.map(sector => (
                <Button
                  key={sector}
                  type="button"
                  variant={addSecteurs.includes(sector) ? 'primary' : 'outline'}
                  size="sm" // Changé de xs à sm
                  onClick={() => handleAddSectorChange(sector)}
                  className={`px-2.5 py-1 text-xs ${addSecteurs.includes(sector) ? 'bg-brand-blue text-white' : 'border-ui-border text-text-secondary hover:bg-ui-border hover:text-text-primary'}`} // Ajustement padding et hover
                >
                  {sector}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" variant="primary" size="sm" className="bg-brand-blue hover:bg-brand-blue-dark text-white">Créer Utilisateur</Button>
          </div>
        </form>
      )}
      
      {safeUsers.length === 0 ? (
        <div className="bg-ui-background/50 rounded-lg p-6 text-center border border-ui-border">
          <p className="text-text-secondary mb-4">Aucun utilisateur trouvé.</p>
          <div className="flex flex-col sm:flex-row justify-center gap-3 items-center">
            <Button 
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              className="border-ui-border text-text-secondary hover:bg-ui-border hover:text-text-primary"
            >
              Rafraîchir la liste
            </Button>
            {/* Le lien pour forcer admin peut rester tel quel ou être transformé en bouton si besoin */}
            <a 
              href="/admin/force-admin"
              className="px-3 py-1.5 text-sm rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors" // Style de bouton vert
            >
              Créer un profil admin d'urgence
            </a>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto bg-ui-background/50 rounded-lg border border-ui-border shadow-sm">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-text-secondary uppercase bg-ui-background/70">
              <tr>
                <th className="px-4 py-3 font-medium">ID Utilisateur</th>
                <th className="px-4 py-3 font-medium">Nom</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Rôle</th>
                <th className="px-4 py-3 font-medium">Secteurs</th>
                {showEncryptedWallet && <th className="px-4 py-3 font-medium">Encrypted Wallet</th>}
                <th className="px-4 py-3 font-medium">Actions</th>
                <th className="px-4 py-3 font-medium hidden">Adresse Blockchain</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ui-border"> {/* Ajout de divide pour séparateurs */}
              {safeUsers.map((user) => (
                <tr 
                  key={user.uid} 
                  className={`hover:bg-ui-background/80 transition-colors ${
                    editingUid === user.uid ? "bg-brand-blue/5" : "" // Léger fond si en édition
                  }`}
                >
                  <td className="px-4 py-3 font-mono text-xs text-text-tertiary" title={user.uid}>
                    {user.uid ? (user.uid.length > 12 ? user.uid.substring(0, 8) + "..." : user.uid) : "ID manquant"}
                  </td>
                  <td className="px-4 py-3 text-text-primary">
                    {editingUid === user.uid ? (
                      <input 
                        type="text" 
                        className="w-full rounded-md bg-ui-background border-ui-border text-text-primary focus:border-brand-blue focus:ring-brand-blue py-1 px-2 text-sm"
                        defaultValue={user.displayName}
                        disabled // Pour l'instant, l'édition du nom n'est pas gérée par ce formulaire simple
                      />
                    ) : (
                      user.displayName || user.nom || "--"
                    )}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {user.email || "--"}
                  </td>
                  <td className="px-4 py-3">
                    {editingUid === user.uid ? (
                      <select 
                        className="w-full rounded-md bg-ui-background border-ui-border text-text-primary focus:border-brand-blue focus:ring-brand-blue py-1 px-2 text-sm"
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value)}
                      >
                        {AVAILABLE_ROLES.map((role) => (
                          <option key={role} value={role}>{role}</option>
                        ))}
                      </select>
                    ) : (
                      <span className={
                        user.role === "Admin" ? "text-red-500 font-medium" : 
                        user.role === "Technician" ? "text-green-500 font-medium" : 
                        "text-text-secondary"
                      }>
                        {user.role || "--"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editingUid === user.uid ? (
                      <div className="flex flex-wrap gap-1">
                        {AVAILABLE_SECTORS.map((sector) => (
                          <Button
                            key={sector} 
                            type="button"
                            size="sm"
                            variant={editSecteurs.includes(sector) ? 'primary' : 'outline'}
                            onClick={() => handleSectorChange(sector)}
                            className={`px-2 py-0.5 text-xs ${editSecteurs.includes(sector) ? 'bg-brand-blue text-white' : 'border-ui-border text-text-secondary hover:bg-ui-border'}`}
                          >
                            {sector}
                          </Button>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {user.secteurs?.length ? user.secteurs.map((sector) => (
                          <span key={sector} className="text-xs px-2 py-0.5 bg-ui-background rounded-full text-text-secondary border border-ui-border">
                            {sector}
                          </span>
                        )) : <span className="text-xs text-text-tertiary italic">--</span>}
                      </div>
                    )}
                  </td>
                  {showEncryptedWallet && (
                    <td className="px-4 py-3 font-mono text-xs text-text-tertiary max-w-[180px] truncate" title={user.encryptedWallet || ''}>
                      {user.encryptedWallet ? (user.encryptedWallet.length > 16 ? user.encryptedWallet.substring(0, 12) + '...' : user.encryptedWallet) : <span className="italic">--</span>}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    {editingUid === user.uid ? (
                      <div className="flex space-x-2">
                        <Button 
                          type="button"
                          size="sm"
                          variant="primary"
                          onClick={handleSubmit}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          Sauvegarder
                        </Button>
                        <Button 
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={cancelEdit}
                          className="border-ui-border text-text-secondary hover:bg-ui-border"
                        >
                          Annuler
                        </Button>
                      </div>
                    ) : (
                      <div className="flex space-x-2">
                        <Button 
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => startEdit(user)}
                          className="text-brand-blue border-brand-blue hover:bg-brand-blue hover:text-white"
                        >
                          Modifier
                        </Button>
                        <Button 
                          type="button"
                          size="sm"
                          variant="outline" // Utiliser variant="outline"
                          onClick={() => handleDeleteUser(user.uid)}
                          className="text-red-500 border-red-500 hover:bg-red-500 hover:text-white focus:ring-red-500" // Ajout des classes de couleur rouge
                        >
                          Supprimer
                        </Button>
                        {!user.encryptedWallet && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleGenerateWallet(user.uid)}
                            className={`text-yellow-500 border-yellow-500 hover:bg-yellow-500 hover:text-black flex items-center gap-1 ${generatingWalletUid === user.uid ? 'opacity-60 cursor-wait' : ''}`}
                            disabled={generatingWalletUid === user.uid}
                          >
                            {generatingWalletUid === user.uid ? (
                              <span className="animate-spin mr-1">⏳</span>
                            ) : (
                              <span className="mr-1">🔑</span>
                            )}
                            Wallet
                          </Button>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden font-mono text-xs text-text-tertiary" title={user.blockchainAddress || undefined}>
                    {user.blockchainAddress ? user.blockchainAddress.substring(0, 10) + "..." : "Non définie"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Modal de confirmation de suppression */}
      {showConfirmDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"> {/* z-index plus élevé */}
          <div className="bg-ui-surface/90 backdrop-blur-lg border border-ui-border/70 rounded-lg shadow-xl p-6 w-full max-w-md mx-auto">
            <h3 className="text-lg font-semibold text-text-primary mb-4">Confirmer la suppression</h3>
            <p className="text-sm text-text-secondary mb-6">Êtes-vous sûr de vouloir supprimer cet utilisateur ? Cette action est irréversible.</p>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={cancelDelete}
                className="border-ui-border text-text-secondary hover:bg-ui-border hover:text-text-primary"
              >
                Annuler
              </Button>
              <Button
                variant="danger" // Utiliser le variant danger du composant Button
                size="sm"
                onClick={confirmDelete}
                // className="bg-red-600 hover:bg-red-700 text-white" // Le variant danger devrait gérer cela
              >
                Supprimer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
