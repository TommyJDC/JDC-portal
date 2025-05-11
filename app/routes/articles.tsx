import { Form, useLoaderData, useSearchParams, useFetcher } from "@remix-run/react";
import { useState, useEffect, useRef } from "react";
// Importer loader et action
import { loader } from "./articles.loader";
import { action } from "./articles.action";
import type { Article as FirestoreArticle } from "~/types/firestore.types"; // Modifié pour utiliser FirestoreArticle
import type { UserProfile } from "~/types/firestore.types";
import type { UserSession } from "~/services/session.server";
import { useOutletContext } from "@remix-run/react";
import { FaPlus, FaSpinner, FaTimes, FaTrashAlt, FaSearch, FaBoxOpen } from 'react-icons/fa';
import { Input } from "~/components/ui/Input";
import { Button } from "~/components/ui/Button";


// Exporter loader et action pour que Remix les utilise
export { loader, action };

// Interface pour le contexte de l'outlet (inchangée)
interface OutletContextType {
  user: UserSession | null; // Changed AppUser to UserSession
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
    <div className="space-y-6 p-6 bg-gray-900 min-h-screen">
      <h1 className="text-3xl font-semibold text-white mb-6 flex items-center">
         <FaSearch className="mr-3 text-jdc-yellow" />
         Recherche d'Articles
         {isLoadingData && <FaSpinner className="ml-3 text-jdc-yellow animate-spin" title="Chargement..." />}
      </h1>

      {/* Formulaire de recherche */}
      <Form method="get" className="mb-8 p-6 bg-gradient-to-br from-[#10182a]/90 via-[#1a2250]/90 to-[#0a1120]/95 rounded-3xl shadow-2xl border border-jdc-yellow/10 animate-fade-in-up backdrop-blur-xl">
        <div className="w-full flex flex-col md:flex-row md:items-end md:space-x-6 gap-4 mb-2">
          <div className="flex-1 flex flex-col justify-end">
            <label htmlFor="code" className="block text-sm font-extrabold text-jdc-yellow mb-1 md:mb-2 tracking-wide drop-shadow-glow uppercase">
              Code Article
            </label>
            <Input
              type="text"
              name="code"
              id="code"
              value={codeSearch}
              onChange={(e) => setCodeSearch(e.target.value)}
              placeholder="Ex : 12345 ou code exact"
              disabled={isLoadingData}
              className="bg-[#10182a]/80 text-white border-jdc-yellow/30 focus:border-jdc-yellow focus:ring-jdc-yellow rounded-xl font-bold placeholder:italic placeholder:text-jdc-yellow/40 shadow-inner"
              labelClassName="text-jdc-yellow"
              autoComplete="off"
            />
          </div>
          <div className="flex-1 flex flex-col justify-end">
            <label htmlFor="nom" className="block text-sm font-extrabold text-jdc-yellow mb-1 md:mb-2 tracking-wide drop-shadow-glow uppercase">
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
              className="bg-[#10182a]/80 text-white border-jdc-yellow/30 focus:border-jdc-yellow focus:ring-jdc-yellow rounded-xl font-bold placeholder:italic placeholder:text-jdc-yellow/40 shadow-inner"
              labelClassName="text-jdc-yellow"
              autoComplete="off"
            />
          </div>
          <div className="flex items-end h-full md:h-[56px] w-full md:w-auto">
            <Button
              type="submit"
              className="w-full md:w-auto bg-jdc-blue text-white hover:bg-jdc-blue-dark font-extrabold py-2 px-8 rounded-2xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#10182a] focus:ring-jdc-yellow transition duration-150 ease-in-out flex items-center justify-center gap-2 shadow-lg h-[44px] md:h-[56px] tracking-wide drop-shadow-glow text-base"
              disabled={isLoadingData}
            >
              {isLoadingData ? (
                <FaSpinner className="animate-spin" />
              ) : (
                <FaSearch />
              )}
              <span>{isLoadingData ? 'Recherche...' : 'Rechercher'}</span>
            </Button>
          </div>
        </div>
      </Form>

      {/* Section des résultats */}
      <div className="bg-gray-800 p-2 sm:p-4 md:p-6 border border-gray-700 rounded-xl shadow-xl">
        <h2 className="text-xl font-semibold mb-4 text-white">Résultats</h2>

        {loaderError && <p className="text-red-400 text-sm mb-3">{loaderError}</p>}

        {/* Afficher l'erreur de l'action seulement si elle existe et a la propriété error */}
        {fetcher.data && !fetcher.data.success && hasErrorProperty(fetcher.data) && (
          <p className="text-red-400 text-sm mb-3">{fetcher.data.error}</p>
        )}

        {isLoadingData && <p className="text-gray-400 italic">Chargement...</p>}

        {!isLoadingData && !loaderError && (
          <>
            {paginatedArticles && paginatedArticles.length > 0 ? (
              <div className="flex flex-col divide-y divide-jdc-yellow/10">
                {paginatedArticles.map((article: FirestoreArticle, idx: number) => { // Modifié pour FirestoreArticle
                  const isUploadingCurrent = uploadingImageId === article.code && fetcher.state !== 'idle';
                  const isDeletingCurrent = (imageUrl: string) => deletingImageUrl === imageUrl && fetcher.state !== 'idle';
                  // Utiliser article.id si disponible et unique, sinon article.code comme fallback.
                  // Firestore documents ont un ID unique. Si 'id' est mappé depuis l'ID du document Firestore, c'est le meilleur choix.
                  // Le type FirestoreArticle a id?: string.
                  const uniqueKey = article.id || article.code; 
                  return (
                    <div
                      key={uniqueKey} // Utiliser une clé unique
                      className="group flex items-center w-full bg-gradient-to-r from-[#10182a]/80 via-[#1a2250]/80 to-[#0a1120]/90 rounded-2xl shadow-xl border-l-4 border-jdc-yellow/40 px-4 py-3 my-1 font-jetbrains backdrop-blur-xl hover:shadow-neon hover:scale-[1.01] transition-all duration-200 cursor-pointer focus-within:shadow-neon"
                      style={{ animationDelay: `${0.1 + idx * 0.03}s` }}
                      tabIndex={0}
                    >
                      <FaBoxOpen className="text-jdc-yellow text-xl flex-shrink-0 mr-4 drop-shadow-glow" />
                      <div className="flex-1 min-w-0 flex flex-col md:flex-row md:items-center gap-1 md:gap-4">
                        <div className="flex flex-col min-w-0">
                          <span className="text-jdc-blue font-extrabold text-base truncate drop-shadow-glow">{article.code}</span>
                          <span className="text-white font-semibold truncate drop-shadow-glow">{article.designation}</span>
                        </div>
                      </div>
                      {article.images && article.images.length > 0 && (
                        <div className="flex flex-row gap-2 ml-4">
                          {article.images.slice(0, 3).map((imageUrl: string, index: number) => (
                            // La clé pour cette sous-liste interne peut être l'index ou l'URL si elle est unique dans ce contexte.
                            <div key={`${uniqueKey}-img-${index}`} className="relative group"> 
                              <img
                                src={imageUrl}
                                alt={article.designation + ' - image ' + (index + 1)}
                                className="w-10 h-10 object-cover rounded-lg border-2 border-jdc-yellow/20 hover:border-jdc-blue transition-transform duration-200 transform hover:scale-105 shadow group-hover:shadow-lg backdrop-blur-md"
                                onClick={e => { e.stopPropagation(); openImageModal(imageUrl); }}
                              />
                              <button
                                type="button"
                                className="absolute -top-2 -right-2 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow"
                                onClick={e => { e.stopPropagation(); handleDeleteImage(article.code, imageUrl); }}
                                disabled={isDeletingCurrent(imageUrl)}
                                aria-label="Supprimer l'image"
                              >
                                {isDeletingCurrent(imageUrl) ? (
                                  <FaSpinner className="animate-spin h-3 w-3" />
                                ) : (
                                  <FaTrashAlt className="h-3 w-3" />
                                )}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center ml-4">
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); handleAddPhotoClick(article.code); }}
                          disabled={isUploadingCurrent}
                          className="inline-flex items-center px-3 py-1.5 text-xs font-bold rounded-xl text-white bg-jdc-blue hover:bg-jdc-blue-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-jdc-blue disabled:opacity-50 disabled:cursor-not-allowed shadow border border-jdc-yellow/20 hover:shadow-neon transition-all"
                          aria-label="Ajouter une photo à l'article"
                        >
                          {isUploadingCurrent ? (
                            <>
                              <FaSpinner className="animate-spin mr-2 h-4 w-4" />
                              <span>Upload en cours...</span>
                            </>
                          ) : (
                            <>
                              <FaPlus className="mr-2 h-4 w-4" />
                              <span>Ajouter une photo</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-400">
                {codeSearch || nomSearch ? "Aucun article trouvé pour les critères spécifiés." : "Veuillez spécifier au moins un critère de recherche."}
              </p>
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
              className="max-w-full max-h-[90vh] object-contain"
            />
            <button
              onClick={closeImageModal}
              className="absolute top-2 right-2 bg-black bg-opacity-70 text-white p-2 rounded-full hover:bg-opacity-90 transition"
              aria-label="Fermer"
            >
              <FaTimes className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
