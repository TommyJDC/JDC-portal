import { Form, useLoaderData, useSearchParams, useFetcher } from "@remix-run/react"; // Importer useFetcher
    import { useState, useEffect, useRef } from "react"; // Importer useRef
    // Importer loader et action
    import { loader } from "./articles.loader";
    import { action } from "./articles.action"; // Importer l'action
    import type { Article, UserProfile } from "~/types/firestore.types";
    import type { UserSession } from "~/services/session.server"; // Import UserSession from session.server
    import { useOutletContext } from "@remix-run/react";
    import { FaPlus, FaSpinner, FaTimes, FaTrashAlt, FaSearch } from 'react-icons/fa'; // Importer icônes React Icons
    import { Input } from "~/components/ui/Input"; // Importer le composant Input
    import { Button } from "~/components/ui/Button"; // Importer le composant Button


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
      const { user, loadingAuth } = useOutletContext<OutletContextType>(); // Récupérer user et loadingAuth
      const fetcher = useFetcher<typeof action>(); // Initialiser le fetcher pour l'action

      // Initialiser l'état local du formulaire avec les paramètres du loader
      const [codeSearch, setCodeSearch] = useState(loaderSearchParams.code);
      const [nomSearch, setNomSearch] = useState(loaderSearchParams.nom);

      // États pour gérer l'upload/suppression d'image UI
      const [uploadingImageId, setUploadingImageId] = useState<string | null>(null); // ID de l'article en cours d'upload
      const [deletingImageUrl, setDeletingImageUrl] = useState<string | null>(null); // URL en cours de suppression

      // Référence pour l'input fichier caché (inchangée)
      const fileInputRef = useRef<HTMLInputElement>(null);

      // États pour la modale d'image (inchangés)
      const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
      const [isImageModalOpen, setIsImageModalOpen] = useState(false);

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
      const handleAddPhotoClick = (articleId: string) => {
        setUploadingImageId(null);
        setDeletingImageUrl(null);
        if (fileInputRef.current) {
          fileInputRef.current.setAttribute('data-article-id', articleId);
          fileInputRef.current.click();
        }
      };

      const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        const targetArticleId = event.target.getAttribute('data-article-id');

        if (file && targetArticleId) {
          console.log(`Fichier sélectionné: ${file.name} pour l'article ID: ${targetArticleId}`);
          setUploadingImageId(targetArticleId);

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
            submitData.append('articleId', targetArticleId);
            submitData.append('imageUrl', imageUrl);
            fetcher.submit(submitData, { method: 'POST', action: '/articles', encType: 'multipart/form-data' });

          } catch (error: any) {
            console.error("Erreur pendant l'upload Cloudinary:", error);
            setUploadingImageId(null);
            alert(`Erreur Cloudinary: ${error.message}`);
          } finally {
             if (fileInputRef.current) {
               fileInputRef.current.value = "";
               fileInputRef.current.removeAttribute('data-article-id');
             }
          }
        } else {
           if (fileInputRef.current) {
               fileInputRef.current.removeAttribute('data-article-id');
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
      const handleDeleteImage = async (articleId: string, imageUrl: string) => {
        if (!window.confirm("Êtes-vous sûr de vouloir supprimer cette image ? Cette action est irréversible.")) {
          return;
        }
        console.log(`Tentative de suppression de l'image: ${imageUrl} pour l'article: ${articleId}`);
        setDeletingImageUrl(imageUrl);

        const submitData = new FormData();
        submitData.append('intent', 'delete_image');
        submitData.append('articleId', articleId);
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
          <Form method="get" className="mb-6 p-6 bg-gray-800 rounded-xl shadow-xl border border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 items-end">
              <div>
                <label htmlFor="code" className="block text-sm font-medium text-gray-400 mb-1">
                  Code Article
                </label>
                <input
                  type="text"
                  name="code"
                  id="code"
                  value={codeSearch}
                  onChange={(e) => setCodeSearch(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-jdc-blue focus:border-jdc-blue bg-gray-900 text-white placeholder-gray-500 text-sm"
                  placeholder="Code exact"
                  disabled={isLoadingData}
                />
              </div>
              <div>
                <label htmlFor="nom" className="block text-sm font-medium text-gray-400 mb-1">
                  Nom Article
                </label>
                <input
                  type="text"
                  name="nom"
                  id="nom"
                  value={nomSearch}
                  onChange={(e) => setNomSearch(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-jdc-blue focus:border-jdc-blue bg-gray-900 text-white placeholder-gray-500 text-sm"
                  placeholder="Nom partiel ou complet"
                  disabled={isLoadingData}
                />
              </div>
              <div className="md:pt-6">
                <button
                  type="submit"
                  className="w-full bg-jdc-blue text-white hover:bg-jdc-blue-dark font-bold py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-jdc-blue transition duration-150 ease-in-out flex items-center justify-center gap-2"
                  disabled={isLoadingData}
                >
                   {isLoadingData ? (
                     <FaSpinner className="animate-spin" />
                   ) : (
                     <FaSearch />
                   )}
                  <span>{isLoadingData ? 'Recherche...' : 'Rechercher'}</span>
                </button>
              </div>
            </div>
          </Form>

          {/* Section des résultats */}
          <div className="bg-gray-800 p-6 border border-gray-700 rounded-xl shadow-xl">
            <h2 className="text-xl font-semibold mb-4 text-white">Résultats</h2>

            {loaderError && <p className="text-red-400 text-sm mb-3">{loaderError}</p>}

            {/* Afficher l'erreur de l'action seulement si elle existe et a la propriété error */}
            {fetcher.data && !fetcher.data.success && hasErrorProperty(fetcher.data) && (
              <p className="text-red-400 text-sm mb-3">{fetcher.data.error}</p>
            )}

            {isLoadingData && <p className="text-gray-400 italic">Chargement...</p>}

            {!isLoadingData && !loaderError && (
              <>
                {loaderArticles && loaderArticles.length > 0 ? (
                  // Remplacer ul par un div avec space-y pour espacer les cartes
                  <div className="space-y-4">
                    {loaderArticles.map((article) => {
                      const isUploadingCurrent = uploadingImageId === article.id && fetcher.state !== 'idle';
                      const isDeletingCurrent = (imageUrl: string) => deletingImageUrl === imageUrl && fetcher.state !== 'idle';

                      return (
                        // Appliquer le style de carte ici (sans bordure colorée)
                        <div
                          key={article.id}
                          className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg shadow-lg p-4 hover:shadow-xl hover:from-gray-700 hover:to-gray-800 transition-all duration-200 flex flex-col space-y-3"
                        >
                          {/* Header: Code et Désignation */}
                          <div className="flex justify-between items-center">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-white text-base truncate" title={`Code: ${article.Code}`}>
                                Code: <span className="text-yellow-400">{article.Code}</span>
                              </p>
                              <p className="text-sm text-gray-300 truncate" title={`Désignation: ${article.Désignation}`}>
                                {article.Désignation}
                              </p>
                            </div>
                            {/* Bouton Ajouter Photo déplacé vers le bas */}
                          </div>

                          {/* Body: Images (si présentes) */}
                          {article.imageUrls && article.imageUrls.length > 0 && (
                            <div className="border-t border-gray-700 pt-3 mt-3">
                              <p className="text-xs text-gray-400 mb-2">Images :</p>
                              <div className="flex flex-wrap gap-2">
                                {article.imageUrls.map((url, index) => {
                                  const deletingThis = isDeletingCurrent(url);
                                  return (
                                    <div key={index} className="relative group">
                                      <img
                                        src={url}
                                        alt={`Image ${index + 1} pour ${article.Code}`}
                                        className={`h-16 w-16 object-cover rounded-md border border-gray-600 transition-opacity ${deletingThis ? 'opacity-50' : 'group-hover:opacity-70 cursor-pointer'}`}
                                        loading="lazy"
                                        onClick={() => !deletingThis && openImageModal(url)}
                                      />
                                      <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); handleDeleteImage(article.id, url); }}
                                        disabled={deletingThis || fetcher.state !== 'idle'}
                                        className={`absolute top-1 right-1 p-1 bg-red-600 bg-opacity-75 rounded-full text-white opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity ${deletingThis ? 'cursor-not-allowed opacity-50' : 'hover:bg-red-700'}`}
                                        aria-label="Supprimer l'image"
                                      >
                                        {deletingThis ? (
                                          <FaSpinner className="h-3 w-3 animate-spin" />
                                        ) : (
                                          <FaTrashAlt className="h-3 w-3" />
                                        )}
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Footer: Bouton Ajouter Photo */}
                          <div className="border-t border-gray-700 pt-3 mt-3 flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleAddPhotoClick(article.id)}
                              disabled={isUploadingCurrent || fetcher.state !== 'idle'}
                              className={`inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-black ${ // text-black pour contraste sur jaune
                                isUploadingCurrent || fetcher.state !== 'idle'
                                  ? 'bg-gray-500 cursor-not-allowed text-gray-300' // Ajuster texte pour état désactivé
                                  : 'bg-jdc-yellow hover:bg-yellow-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-jdc-yellow'
                              }`}
                            >
                              {isUploadingCurrent ? (
                                <FaSpinner className="mr-1.5 animate-spin h-4 w-4" />
                              ) : (
                                <FaPlus className="-ml-0.5 mr-1.5 h-4 w-4" aria-hidden="true" />
                              )}
                              <span>{isUploadingCurrent ? 'Upload...' : 'Ajouter Photo'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-gray-400 italic">
                    {loaderSearchParams.code || loaderSearchParams.nom
                      ? "Aucun article trouvé pour ces critères."
                      : "Effectuez une recherche pour afficher les résultats."}
                     {!user && !loadingAuth && " Veuillez vous connecter pour effectuer une recherche."}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Input fichier caché (inchangé) */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelected}
            accept="image/*"
            style={{ display: 'none' }}
            data-article-id=""
          />

          {/* Modale pour afficher l'image en grand (inchangée) */}
          {isImageModalOpen && selectedImageUrl && (
            <div
              className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
              onClick={closeImageModal}
            >
              <div
                className="relative bg-gray-800 p-4 rounded-lg max-w-3xl max-h-[80vh] border border-gray-700"
                onClick={(e) => e.stopPropagation()}
              >
                <img
                  src={selectedImageUrl}
                  alt="Image agrandie"
                  className="block max-w-full max-h-[calc(80vh-40px)] object-contain rounded-md"
                />
                <button
                  onClick={closeImageModal}
                  className="absolute top-3 right-3 text-white bg-gray-700 bg-opacity-75 hover:bg-opacity-100 rounded-full p-1 focus:outline-none"
                  aria-label="Fermer l'image"
                >
        <FaTimes className="h-6 w-6" />
                </button>
              </div>
            </div>
          )}
        </div>
      );
    }
