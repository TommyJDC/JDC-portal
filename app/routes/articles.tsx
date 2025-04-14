import { Form, useLoaderData, useSearchParams, useFetcher } from "@remix-run/react"; // Importer useFetcher
    import { useState, useEffect, useRef } from "react"; // Importer useRef
    // Importer loader et action
    import { loader } from "./articles.loader";
    import { action } from "./articles.action"; // Importer l'action
    import type { Article, AppUser, UserProfile } from "~/types/firestore.types";
    import { useOutletContext } from "@remix-run/react";
    import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'; // Importer pour icônes
    import { faPlus, faSpinner, faTimes, faTrashAlt } from '@fortawesome/free-solid-svg-icons'; // Importer icônes + faTrashAlt

    // Exporter loader et action pour que Remix les utilise
    export { loader, action };

    // Interface pour le contexte de l'outlet (inchangée)
    interface OutletContextType {
      user: AppUser | null;
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
            fetcher.submit(submitData, { method: 'POST', encType: 'multipart/form-data' });

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
        fetcher.submit(submitData, { method: 'POST', encType: 'multipart/form-data' });
      };


      const isLoadingData = fetcher.state === 'loading';

      return (
        <div className="container mx-auto p-4">
          <h1 className="text-2xl font-bold mb-4 text-gray-100">Recherche d'Articles</h1>

          {/* Formulaire de recherche (inchangé, utilise GET) */}
          <Form method="get" className="mb-6 p-4 border border-gray-700 rounded-lg shadow-sm bg-jdc-blue-darker">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 items-end">
              <div>
                <label htmlFor="code" className="block text-sm font-medium text-gray-300 mb-1">
                  Code Article
                </label>
                <input
                  type="text"
                  name="code"
                  id="code"
                  value={codeSearch}
                  onChange={(e) => setCodeSearch(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-jdc-gray-800 text-gray-100 placeholder-gray-400"
                  placeholder="Code exact"
                />
              </div>
              <div>
                <label htmlFor="nom" className="block text-sm font-medium text-gray-300 mb-1">
                  Nom Article
                </label>
                <input
                  type="text"
                  name="nom"
                  id="nom"
                  value={nomSearch}
                  onChange={(e) => setNomSearch(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-jdc-gray-800 text-gray-100 placeholder-gray-400"
                  placeholder="Nom partiel ou complet"
                />
              </div>
              <div className="md:pt-6">
                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md focus:outline-none focus:shadow-outline transition duration-150 ease-in-out"
                  disabled={isLoadingData}
                >
                  {isLoadingData ? 'Recherche...' : 'Rechercher'}
                </button>
              </div>
            </div>
          </Form>

          {/* Section des résultats */}
          <div className="bg-jdc-blue-darker p-4 border border-gray-700 rounded-lg shadow-sm">
            <h2 className="text-xl font-semibold mb-3 text-gray-200">Résultats</h2>

            {loaderError && <p className="text-red-500 text-sm mb-3">{loaderError}</p>}

            {/* Afficher l'erreur de l'action seulement si elle existe et a la propriété error */}
            {fetcher.data && !fetcher.data.success && hasErrorProperty(fetcher.data) && (
              <p className="text-red-500 text-sm mb-3">{fetcher.data.error}</p>
            )}

            {isLoadingData && <p className="text-gray-400 italic">Chargement...</p>}

            {!isLoadingData && !loaderError && (
              <>
                {loaderArticles && loaderArticles.length > 0 ? (
                  <ul className="divide-y divide-gray-700">
                    {loaderArticles.map((article) => {
                      const isUploadingCurrent = uploadingImageId === article.id && fetcher.state !== 'idle';
                      const isDeletingCurrent = (imageUrl: string) => deletingImageUrl === imageUrl && fetcher.state !== 'idle';

                      return (
                        <li key={article.id} className="py-4 px-1 hover:bg-jdc-gray-800">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-gray-100">Code: {article.Code}</p>
                              <p className="text-sm text-gray-300">Désignation: {article.Désignation}</p>
                              {article.imageUrls && article.imageUrls.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {article.imageUrls.map((url, index) => {
                                    const deletingThis = isDeletingCurrent(url);
                                    return (
                                      <div key={index} className="relative group">
                                        <img
                                          src={url}
                                          alt={`Image ${index + 1} pour ${article.Code}`}
                                          className={`h-16 w-16 object-cover rounded border border-gray-600 transition-opacity ${deletingThis ? 'opacity-50' : 'group-hover:opacity-70 cursor-pointer'}`}
                                          loading="lazy"
                                          onClick={() => !deletingThis && openImageModal(url)}
                                        />
                                        <button
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); handleDeleteImage(article.id, url); }}
                                          disabled={deletingThis || fetcher.state !== 'idle'}
                                          className={`absolute top-0 right-0 p-1 bg-red-600 bg-opacity-75 rounded-full text-white opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity ${deletingThis ? 'cursor-not-allowed opacity-50' : 'hover:bg-red-700'}`}
                                          aria-label="Supprimer l'image"
                                        >
                                          {deletingThis ? (
                                            <FontAwesomeIcon icon={faSpinner} spin className="h-3 w-3" />
                                          ) : (
                                            <FontAwesomeIcon icon={faTrashAlt} className="h-3 w-3" />
                                          )}
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                            <div className="ml-4 flex-shrink-0">
                              <button
                                type="button"
                                onClick={() => handleAddPhotoClick(article.id)}
                                disabled={isUploadingCurrent || fetcher.state !== 'idle'}
                                className={`inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded shadow-sm text-white ${
                                  isUploadingCurrent || fetcher.state !== 'idle'
                                    ? 'bg-gray-500 cursor-not-allowed'
                                    : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-jdc-blue-darker focus:ring-indigo-500'
                                }`}
                              >
                                {isUploadingCurrent ? (
                                  <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
                                ) : (
                                  <FontAwesomeIcon icon={faPlus} className="-ml-1 mr-2 h-4 w-4" aria-hidden="true" />
                                )}
                                <span>{isUploadingCurrent ? 'Upload...' : 'Photo'}</span>
                              </button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
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
                className="relative bg-white p-2 rounded-lg max-w-3xl max-h-[80vh]"
                onClick={(e) => e.stopPropagation()}
              >
                <img
                  src={selectedImageUrl}
                  alt="Image agrandie"
                  className="block max-w-full max-h-[calc(80vh-40px)] object-contain"
                />
                <button
                  onClick={closeImageModal}
                  className="absolute top-2 right-2 text-black bg-white bg-opacity-50 hover:bg-opacity-75 rounded-full p-1 focus:outline-none"
                  aria-label="Fermer l'image"
                >
                  <FontAwesomeIcon icon={faTimes} size="lg" />
                </button>
              </div>
            </div>
          )}
        </div>
      );
    }
