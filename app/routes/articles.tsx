import { Form, useLoaderData, useSearchParams, useFetcher } from "@remix-run/react";
import { useState, useEffect, useRef } from "react";
// Importer loader et action
import { loader } from "./articles.loader";
import { action } from "./articles.action";
import type { Article as FirestoreArticle } from "~/types/firestore.types"; // Modifié pour utiliser FirestoreArticle
import type { UserProfile } from "~/types/firestore.types";
import type { UserSessionData } from "~/services/session.server"; // Correction du type
import { useOutletContext } from "@remix-run/react";
import { FaPlus, FaSpinner, FaTimes, FaTrashAlt, FaSearch, FaBoxOpen } from 'react-icons/fa';
import { Input } from "~/components/ui/Input";
import { Button } from "~/components/ui/Button";


// Exporter loader et action pour que Remix les utilise
export { loader, action };

// Interface pour le contexte de l'outlet (inchangée)
interface OutletContextType {
  user: UserSessionData | null; // Correction du type
  profile: UserProfile | null;
  loadingAuth: boolean;
}

// Type guard pour vérifier si l'objet a une propriété 'error'
function hasErrorProperty(obj: any): obj is { error: string } {
  return obj && typeof obj.error === 'string';
}

// Composant pour la page de recherche
export default function ArticlesSearch() {
  // Utiliser les données du loader (articles, searchParams, error)
  const { searchParams: loaderSearchParams, articles: loaderArticles, error: loaderError } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const { user, loadingAuth } = useOutletContext<OutletContextType>();
  const fetcher = useFetcher<typeof action>();

  // Initialiser l'état local du formulaire avec les paramètres du loader
  const [codeSearch, setCodeSearch] = useState(loaderSearchParams.code);
  const [nomSearch, setNomSearch] = useState(loaderSearchParams.nom);

  // États pour gérer l'upload/suppression d'image UI
  const [uploadingImageId, setUploadingImageId] = useState<string | null>(null);
  const [deletingImageUrl, setDeletingImageUrl] = useState<string | null>(null);

  // Référence pour l'input fichier caché (inchangée)
  const fileInputRef = useRef<HTMLInputElement>(null);

  // États pour la modale d'image (inchangés)
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  // En haut du composant ArticlesSearch
  const ARTICLES_PER_PAGE = 10;
  const [currentPage, setCurrentPage] = useState(1);

  // Pagination des articles
  const paginatedArticles = loaderArticles ? (loaderArticles as FirestoreArticle[]).slice((currentPage - 1) * ARTICLES_PER_PAGE, currentPage * ARTICLES_PER_PAGE) : []; // Modifié pour FirestoreArticle
  const totalPages = loaderArticles ? Math.ceil(loaderArticles.length / ARTICLES_PER_PAGE) : 1;

  // Effet pour synchroniser l'état du formulaire avec les searchParams de l'URL
  useEffect(() => {
    setCodeSearch(searchParams.get("code") || "");
    setNomSearch(searchParams.get("nom") || "");
  }, [searchParams]);

  // Effet pour gérer les retours du fetcher (upload/delete)
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      // Vérifier si l'action a échoué et si la propriété 'error' existe
      if (!fetcher.data.success && hasErrorProperty(fetcher.data)) {
        console.error("Action Error:", fetcher.data.error);
        // On pourrait utiliser un toast ici pour informer l'utilisateur
      }
      // Réinitialiser les états UI après l'action, que ce soit succès ou échec
      // Le rechargement du loader mettra à jour la liste si succès
      setUploadingImageId(null);
      setDeletingImageUrl(null);
    }
  }, [fetcher.state, fetcher.data]);


  // --- Fonctions pour gérer l'upload --- (Modifiées pour utiliser fetcher)
  const handleAddPhotoClick = (articleCode: string) => {
    setUploadingImageId(null);
    setDeletingImageUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.setAttribute('data-article-code', articleCode);
      fileInputRef.current.click();
    }
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const targetArticleCode = event.target.getAttribute('data-article-code');

    if (file && targetArticleCode) {
      console.log(`Fichier sélectionné: ${file.name} pour l'article Code: ${targetArticleCode}`);
      setUploadingImageId(targetArticleCode);

      const CLOUDINARY_CLOUD_NAME = "dkeqzl54y";
      const CLOUDINARY_UPLOAD_PRESET = "jdc-img";
      const CLOUDINARY_API_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
      const cloudinaryFormData = new FormData();
      cloudinaryFormData.append('file', file);
      cloudinaryFormData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

      try {
        const response = await fetch(CLOUDINARY_API_URL, { method: 'POST', body: cloudinaryFormData });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || `Échec de l'upload Cloudinary (HTTP ${response.status})`);
        }
        const data = await response.json();
        const imageUrl = data.secure_url;
        console.log("Upload Cloudinary réussi. URL:", imageUrl);

        const submitData = new FormData();
        submitData.append('intent', 'add_image');
        submitData.append('articleId', targetArticleCode);
        submitData.append('imageUrl', imageUrl);
        fetcher.submit(submitData, { method: 'POST', action: '/articles', encType: 'multipart/form-data' });

      } catch (error: any) {
        console.error("Erreur pendant l'upload Cloudinary:", error);
        setUploadingImageId(null);
        alert(`Erreur Cloudinary: ${error.message}`);
      } finally {
         if (fileInputRef.current) {
           fileInputRef.current.value = "";
           fileInputRef.current.removeAttribute('data-article-code');
         }
      }
    } else {
       if (fileInputRef.current) {
           fileInputRef.current.removeAttribute('data-article-code');
       }
    }
  };

  // --- Fonctions pour la modale image --- (inchangées)
  const openImageModal = (imageUrl: string) => {
    setSelectedImageUrl(imageUrl);
    setIsImageModalOpen(true);
  };

  const closeImageModal = () => {
    setIsImageModalOpen(false);
    setSelectedImageUrl(null);
  };

  // --- Fonction pour gérer la suppression d'image --- (Modifiée pour utiliser fetcher)
  const handleDeleteImage = async (articleCode: string, imageUrl: string) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer cette image ? Cette action est irréversible.")) {
      return;
    }
    console.log(`Tentative de suppression de l'image: ${imageUrl} pour l'article: ${articleCode}`);
    setDeletingImageUrl(imageUrl);

    const submitData = new FormData();
    submitData.append('intent', 'delete_image');
    submitData.append('articleId', articleCode);
    submitData.append('imageUrl', imageUrl);
    fetcher.submit(submitData, { method: 'POST', action: '/articles', encType: 'multipart/form-data' });
  };


  const isLoadingData = fetcher.state === 'loading';

  return (
    <div className="space-y-6"> {/* p-6 est sur le layout parent, bg-gray-900 retiré */}
      <h1 className="text-2xl font-semibold text-text-primary mb-6 flex items-center">
         <FaSearch className="mr-3 text-brand-blue h-6 w-6" />
         Recherche d'Articles
         {isLoadingData && <FaSpinner className="ml-3 text-brand-blue animate-spin" title="Chargement..." />}
      </h1>

      {/* Formulaire de recherche */}
      <Form method="get" className="p-4 sm:p-6 bg-ui-surface/80 backdrop-blur-lg border border-ui-border/70 rounded-xl shadow-lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 items-end">
          <div>
            <label htmlFor="code" className="block text-xs font-medium text-text-secondary mb-1">
              Code Article
            </label>
            <Input
              type="text"
              name="code"
              id="code"
              value={codeSearch}
              onChange={(e) => setCodeSearch(e.target.value)}
              placeholder="Ex : 12345"
              disabled={isLoadingData}
              className="bg-ui-input border-ui-border text-text-primary focus:border-brand-blue focus:ring-brand-blue rounded-md placeholder:text-text-tertiary text-sm"
              autoComplete="off"
            />
          </div>
          <div>
            <label htmlFor="nom" className="block text-xs font-medium text-text-secondary mb-1">
              Nom Article
            </label>
            <Input
              type="text"
              name="nom"
              id="nom"
              value={nomSearch}
              onChange={(e) => setNomSearch(e.target.value)}
              placeholder="Nom partiel ou complet"
              disabled={isLoadingData}
              className="bg-ui-input border-ui-border text-text-primary focus:border-brand-blue focus:ring-brand-blue rounded-md placeholder:text-text-tertiary text-sm"
              autoComplete="off"
            />
          </div>
          <div className="md:col-span-2 flex justify-end"> {/* Bouton sur toute la largeur sur mobile, à droite sur desktop */}
            <Button
              type="submit"
              variant="primary"
              className="w-full md:w-auto bg-brand-blue hover:bg-brand-blue-dark text-white flex items-center justify-center gap-2 text-sm py-2.5"
              disabled={isLoadingData}
            >
              {isLoadingData ? (
                <FaSpinner className="animate-spin h-4 w-4" />
              ) : (
                <FaSearch className="h-4 w-4" />
              )}
              <span>{isLoadingData ? 'Recherche...' : 'Rechercher'}</span>
            </Button>
          </div>
        </div>
      </Form>

      {/* Section des résultats */}
      <div className="bg-ui-surface rounded-lg shadow-md p-4 sm:p-6">
        <h2 className="text-lg font-semibold mb-4 text-text-primary">Résultats de la recherche</h2>

        {loaderError && <p className="text-red-400 text-sm mb-3">{loaderError}</p>}

        {fetcher.data && !fetcher.data.success && hasErrorProperty(fetcher.data) && (
          <p className="text-red-400 text-sm mb-3">{fetcher.data.error}</p>
        )}

        {isLoadingData && <div className="flex justify-center items-center py-10"><FaSpinner className="animate-spin text-brand-blue h-8 w-8" /></div>}

        {!isLoadingData && !loaderError && (
          <>
            {paginatedArticles && paginatedArticles.length > 0 ? (
              <div className="space-y-3">
                {paginatedArticles.map((article: FirestoreArticle) => { 
                  const isUploadingCurrent = uploadingImageId === article.code && fetcher.state !== 'idle';
                  const isDeletingCurrent = (imageUrl: string) => deletingImageUrl === imageUrl && fetcher.state !== 'idle';
                  const uniqueKey = article.id || article.code; 
                  return (
                    <div
                      key={uniqueKey}
                      className="group flex flex-col sm:flex-row items-start sm:items-center w-full bg-ui-background hover:bg-ui-background-hover rounded-lg shadow-sm border-l-4 border-brand-blue p-3 sm:p-4 transition-all duration-200 focus-within:ring-2 focus-within:ring-brand-blue"
                      tabIndex={0}
                    >
                      <FaBoxOpen className="text-brand-blue text-xl flex-shrink-0 mr-3 mt-1 sm:mt-0" />
                      <div className="flex-1 min-w-0 mb-2 sm:mb-0">
                        <span className="text-brand-blue font-semibold text-sm block truncate">{article.code}</span>
                        <span className="text-text-primary text-base font-medium block truncate">{article.designation}</span>
                      </div>
                      
                      {/* Images */}
                      <div className="flex flex-row flex-wrap gap-2 items-center my-2 sm:my-0 sm:ml-4">
                        {article.images && article.images.slice(0, 3).map((imageUrl: string, index: number) => (
                          <div key={`${uniqueKey}-img-${index}`} className="relative group/image"> 
                            <img
                              src={imageUrl}
                              alt={`${article.designation} - image ${index + 1}`}
                              className="w-10 h-10 object-cover rounded-md border border-ui-border hover:opacity-80 cursor-pointer transition-opacity"
                              onClick={e => { e.stopPropagation(); openImageModal(imageUrl); }}
                            />
                            <Button
                              type="button"
                              variant="danger"
                              size="icon"
                              className="absolute -top-1.5 -right-1.5 h-5 w-5 p-0.5 opacity-0 group-hover/image:opacity-100 transition-opacity"
                              onClick={e => { e.stopPropagation(); handleDeleteImage(article.code, imageUrl); }}
                              disabled={isDeletingCurrent(imageUrl)}
                              aria-label="Supprimer l'image"
                            >
                              {isDeletingCurrent(imageUrl) ? <FaSpinner className="animate-spin h-2.5 w-2.5" /> : <FaTrashAlt className="h-2.5 w-2.5" />}
                            </Button>
                          </div>
                        ))}
                      </div>

                      {/* Bouton Ajouter Photo */}
                      <div className="flex items-center ml-auto sm:ml-4 mt-2 sm:mt-0">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={e => { e.stopPropagation(); handleAddPhotoClick(article.code); }}
                          disabled={isUploadingCurrent}
                          className="border-ui-border text-text-secondary hover:bg-ui-border hover:text-text-primary flex items-center gap-1.5 text-xs py-1 px-2.5"
                          aria-label="Ajouter une photo"
                        >
                          {isUploadingCurrent ? (
                            <> <FaSpinner className="animate-spin h-3.5 w-3.5" /> Upload... </>
                          ) : (
                            <> <FaPlus className="h-3.5 w-3.5" /> Photo </>
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-10 text-text-secondary">
                <FaBoxOpen className="mx-auto text-4xl mb-3 opacity-40" />
                <p>{codeSearch || nomSearch ? "Aucun article trouvé." : "Veuillez lancer une recherche."}</p>
              </div>
            )}
          </>
        )}
      </div>
      {/* Input caché pour l'upload de fichier, toujours présent dans le DOM */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelected}
        style={{ display: 'none' }}
      />
      {isImageModalOpen && selectedImageUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="max-w-4xl max-h-[90vh] overflow-hidden relative">
            <img
              src={selectedImageUrl}
              alt="Image agrandie"
              className="max-w-full max-h-[90vh] object-contain rounded-md" // Ajout de rounded-md
            />
            <button
              onClick={closeImageModal}
              className="absolute top-3 right-3 bg-ui-background/70 text-text-primary p-1.5 rounded-full hover:bg-ui-border transition-colors"
              aria-label="Fermer"
            >
              <FaTimes className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      {/* TODO: Ajouter la pagination ici si nécessaire, en utilisant totalPages et currentPage */}
    </div>
  );
}
