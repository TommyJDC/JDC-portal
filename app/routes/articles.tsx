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
  // Log de base pour vérifier que le composant est monté
  console.log("%c[Articles Component] Component mounted", "color: #ff00ff; font-size: 20px; font-weight: bold;");

  // Utiliser les données du loader (articles, searchParams, error)
  const loaderData = useLoaderData();
  console.log("%c[Articles Component] Loader data:", "color: #ff00ff; font-size: 20px; font-weight: bold;", loaderData);
  
  const { searchParams: loaderSearchParams, articles: loaderArticles, error: loaderError } = loaderData as any;
  console.log("%c[Articles Component] Parsed data:", "color: #ff00ff; font-size: 20px; font-weight: bold;", {
    searchParams: loaderSearchParams,
    articlesCount: loaderArticles?.length,
    error: loaderError
  });

  const [searchParams, setSearchParams] = useSearchParams();
  console.log("%c[Articles Component] Current URL search params:", "color: #ff00ff; font-size: 20px; font-weight: bold;", Object.fromEntries(searchParams.entries()));

  const { user, loadingAuth } = useOutletContext<OutletContextType>();
  const fetcher = useFetcher<typeof action>();

  const [codeSearch, setCodeSearch] = useState(loaderSearchParams.code);
  const [nomSearch, setNomSearch] = useState(loaderSearchParams.nom);
  const [uploadingImageId, setUploadingImageId] = useState<string | null>(null);
  const [deletingImageUrl, setDeletingImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const ARTICLES_PER_PAGE = 10;
  const [currentPage, setCurrentPage] = useState(1);
  const [isSearching, setIsSearching] = useState(false);

  const paginatedArticles = loaderArticles ? (loaderArticles as FirestoreArticle[]).slice((currentPage - 1) * ARTICLES_PER_PAGE, currentPage * ARTICLES_PER_PAGE) : [];
  const totalPages = loaderArticles ? Math.ceil(loaderArticles.length / ARTICLES_PER_PAGE) : 1;

  useEffect(() => {
    setCodeSearch(searchParams.get("code") || "");
    setNomSearch(searchParams.get("nom") || "");
  }, [searchParams]);

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      if (!fetcher.data.success && hasErrorProperty(fetcher.data)) {
        console.error("Action Error:", fetcher.data.error);
      }
      setUploadingImageId(null);
      setDeletingImageUrl(null);
    }
  }, [fetcher.state, fetcher.data]);

  // Log quand les états changent
  useEffect(() => {
    console.log("%c[Articles Component] State changed:", "color: #ff00ff; font-size: 20px; font-weight: bold;", {
      codeSearch,
      nomSearch
    });
  }, [codeSearch, nomSearch]);

  // Log quand le composant est démonté
  useEffect(() => {
    return () => {
      console.log("%c[Articles Component] Component unmounted", "color: #ff00ff; font-size: 20px; font-weight: bold;");
    };
  }, []);

  // Effet pour gérer la recherche
  useEffect(() => {
    if (isSearching) {
      console.log("%c[Articles Component] Triggering search", "color: #ff00ff; font-size: 20px; font-weight: bold;", {
        code: codeSearch,
        nom: nomSearch
      });

      const newParams = new URLSearchParams();
      if (codeSearch) newParams.set('code', codeSearch);
      if (nomSearch) newParams.set('nom', nomSearch);
      
      setSearchParams(newParams);
      setIsSearching(false);
    }
  }, [isSearching, codeSearch, nomSearch, setSearchParams]);

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

  const openImageModal = (imageUrl: string) => {
    setSelectedImageUrl(imageUrl);
    setIsImageModalOpen(true);
  };

  const closeImageModal = () => {
    setIsImageModalOpen(false);
    setSelectedImageUrl(null);
  };

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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("%c[Articles Component] Search button clicked", "color: #ff00ff; font-size: 20px; font-weight: bold;");
    setIsSearching(true);
  };

  return (
    <div className="space-y-6"> {/* p-6 est sur le layout parent, bg-gray-900 retiré */}
      <h1 className="text-2xl font-semibold text-text-primary mb-6 flex items-center">
         <FaSearch className="mr-3 text-brand-blue h-6 w-6" />
         Recherche d'Articles
         {isSearching && <FaSpinner className="ml-3 text-brand-blue animate-spin" title="Chargement..." />}
      </h1>
      {loaderError && <p>Erreur loader: {loaderError}</p>}

      <form onSubmit={handleSearch} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-text-secondary mb-1">
              Code Article
            </label>
            <Input
              id="code"
              name="code"
              type="text"
              value={codeSearch}
              onChange={(e) => {
                console.log("%c[Articles Component] Code search changed:", "color: #ff00ff; font-size: 20px; font-weight: bold;", e.target.value);
                setCodeSearch(e.target.value);
              }}
              placeholder="Entrez le code article"
              className="w-full"
            />
          </div>
          <div>
            <label htmlFor="nom" className="block text-sm font-medium text-text-secondary mb-1">
              Nom Article
            </label>
            <Input
              id="nom"
              name="nom"
              type="text"
              value={nomSearch}
              onChange={(e) => {
                console.log("%c[Articles Component] Nom search changed:", "color: #ff00ff; font-size: 20px; font-weight: bold;", e.target.value);
                setNomSearch(e.target.value);
              }}
              placeholder="Entrez le nom de l'article"
              className="w-full"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button 
            type="submit" 
            className="bg-brand-blue hover:bg-brand-blue/90"
          >
            <FaSearch className="mr-2" />
            Rechercher
          </Button>
        </div>
      </form>

      {paginatedArticles.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedArticles.map((article) => (
            <div
              key={article.id}
              className="bg-ui-surface rounded-lg shadow-md p-4 border border-ui-border hover:shadow-lg transition-shadow"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-lg font-semibold text-text-primary">{article.Code}</h3>
                  <p className="text-text-secondary">{article.Désignation}</p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleAddPhotoClick(article.Code)}
                    className="p-2 text-brand-blue hover:bg-brand-blue/10 rounded-full transition-colors"
                    title="Ajouter une photo"
                  >
                    <FaPlus />
                  </button>
                </div>
              </div>

              {article.images && article.images.length > 0 && (
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {article.images.map((imageUrl, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={imageUrl}
                        alt={`Article ${article.Code} - Image ${index + 1}`}
                        className="w-full h-24 object-cover rounded-lg cursor-pointer"
                        onClick={() => openImageModal(imageUrl)}
                      />
                      <button
                        onClick={() => handleDeleteImage(article.Code, imageUrl)}
                        className="absolute top-1 right-1 p-1 bg-red-500/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Supprimer l'image"
                      >
                        <FaTrashAlt className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3 text-sm text-text-tertiary">
                <p>Type: {article.type || 'Non spécifié'}</p>
                <p>Catégorie: {article.category || 'Non spécifiée'}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-6 rounded-lg bg-ui-surface border border-ui-border text-center text-text-secondary">
          <FaBoxOpen className="w-12 h-12 mx-auto mb-3 text-text-tertiary" />
          <p className="font-medium">Aucun article trouvé</p>
          {codeSearch || nomSearch ? (
            <p className="text-sm mt-1">Essayez avec d'autres critères de recherche</p>
          ) : (
            <p className="text-sm mt-1">Utilisez le formulaire ci-dessus pour rechercher des articles</p>
          )}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center space-x-2 mt-6">
          <Button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="bg-ui-surface hover:bg-ui-surface/80"
          >
            Précédent
          </Button>
          <span className="px-4 py-2 text-text-secondary">
            Page {currentPage} sur {totalPages}
          </span>
          <Button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="bg-ui-surface hover:bg-ui-surface/80"
          >
            Suivant
          </Button>
        </div>
      )}

      {isImageModalOpen && selectedImageUrl && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="relative max-w-4xl max-h-[90vh] p-4">
            <img
              src={selectedImageUrl}
              alt="Image article"
              className="max-w-full max-h-[80vh] object-contain"
            />
            <button
              onClick={closeImageModal}
              className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full hover:bg-black/70"
            >
              <FaTimes />
            </button>
          </div>
        </div>
      )}

      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleFileSelected}
      />
    </div>
  );
}
