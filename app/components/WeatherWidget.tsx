import React, { useEffect, useState } from 'react';
import { FaMapMarkerAlt, FaSpinner, FaExclamationCircle } from 'react-icons/fa';

// Ville par défaut si la géolocalisation échoue
const DEFAULT_CITY = 'Paris';
const DEFAULT_COORDS = { lat: 48.8566, lon: 2.3522 };

// Types pour les données météo
interface WeatherData {
  temp: number;
  description: string;
  city: string;
  symbol?: string;
}

// Type pour les coordonnées GPS
interface Coordinates {
  lat: number;
  lon: number;
}

export const WeatherWidget: React.FC<{ city?: string }> = ({ city = DEFAULT_CITY }) => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [usingGeolocation, setUsingGeolocation] = useState(false);
  const [cityName, setCityName] = useState<string>(city);

  // Demande la géolocalisation au chargement
  useEffect(() => {
    setLoading(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('[WeatherWidget] Coordonnées récupérées :', position.coords.latitude, position.coords.longitude);
          setCoords({ lat: position.coords.latitude, lon: position.coords.longitude });
          setUsingGeolocation(true);
        },
        (err) => {
          console.log("Erreur de géolocalisation:", err.message);
          setCoords(DEFAULT_COORDS);
          setUsingGeolocation(false);
        },
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
      );
    } else {
      setCoords(DEFAULT_COORDS);
      setUsingGeolocation(false);
    }
  }, []);

  // Reverse geocoding pour obtenir le nom de la ville
  useEffect(() => {
    if (coords && usingGeolocation) {
      const { lat, lon } = coords;
      console.log('[WeatherWidget] Appel Nominatim pour :', lat, lon);
      fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=fr`)
        .then(res => res.json())
        .then(data => {
          console.log('[WeatherWidget] Réponse Nominatim :', data);
          // On cherche le nom de la ville ou du village ou du quartier
          const ville = data.address?.city || data.address?.town || data.address?.village || data.address?.hamlet || data.address?.municipality || data.address?.county || data.address?.state || city;
          setCityName(ville);
        })
        .catch(() => setCityName(city));
    } else {
      setCityName(city);
    }
  }, [coords, usingGeolocation, city]);

  useEffect(() => {
    console.log('[WeatherWidget] cityName mis à jour :', cityName);
  }, [cityName]);

  // Récupère les données météo de l'API met.no
  useEffect(() => {
    if (!coords) return;
    
    setLoading(true);
    setError(null);
    
    const { lat, lon } = coords;
    fetch(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`, {
      headers: {
        'User-Agent': 'JDC-portal/1.0 contact@jdc.fr',
        'Accept': 'application/json'
      }
    })
      .then(res => {
        if (!res.ok) {
          throw new Error(`Erreur API: ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        const timeseries = data.properties?.timeseries?.[0];
        if (!timeseries) {
          throw new Error("Données météo non disponibles");
        }
        
        const temp = timeseries.data?.instant?.details?.air_temperature;
        const next1h = timeseries.data?.next_1_hours || timeseries.data?.next_6_hours;
        const symbol = next1h?.summary?.symbol_code || 'unknown';
        
        setWeather({
          temp: temp,
          description: formatWeatherDescription(symbol),
          city: cityName,
          symbol: symbol
        });
      })
      .catch(err => {
        console.error("Erreur météo:", err);
        setError("Météo indisponible");
      })
      .finally(() => setLoading(false));
  }, [city, coords, usingGeolocation, cityName]);

  // Formate la description météo en français
  const formatWeatherDescription = (symbolCode: string): string => {
    const baseName = symbolCode.replace(/_/g, ' ').replace(/day|night/g, '').trim();
    
    const weatherMap: Record<string, string> = {
      'clearsky': 'Ciel dégagé',
      'fair': 'Ciel clair',
      'partlycloudy': 'Partiellement nuageux',
      'cloudy': 'Nuageux',
      'fog': 'Brouillard',
      'rain': 'Pluie',
      'rainshowers': 'Averses',
      'heavyrain': 'Fortes pluies',
      'heavyrainshowers': 'Fortes averses',
      'lightrainshowers': 'Légères averses',
      'lightrain': 'Pluie légère',
      'sleet': 'Grésil',
      'snow': 'Neige',
      'snowshowers': 'Averses de neige',
      'lightsnow': 'Neige légère',
      'lightsnowshowers': 'Légères averses de neige',
      'heavysnow': 'Fortes chutes de neige',
      'heavysnowshowers': 'Fortes averses de neige',
      'thunder': 'Orages',
      'sleetshowers': 'Averses de grésil'
    };
    
    return weatherMap[baseName] || baseName;
  };

  // Affichage pendant le chargement
  if (loading) {
    return (
      <div className="flex items-center gap-2 animate-pulse bg-white/10 backdrop-blur-md rounded-xl px-4 py-2 shadow border border-white/20">
        <FaSpinner className="animate-spin w-5 h-5 text-jdc-yellow" />
        <div className="h-4 w-24 bg-gray-700/50 rounded" />
      </div>
    );
  }
  
  // Affichage en cas d'erreur
  if (error || !weather) {
    return (
      <div className="flex items-center gap-2 bg-red-900/30 text-red-300 rounded-xl px-4 py-2 text-sm backdrop-blur-md shadow border border-red-500/20">
        <FaExclamationCircle className="text-red-400" />
        Météo indisponible
      </div>
    );
  }
  
  // URL de l'icône météo met.no (SVG)
  const iconUrl = weather.symbol
    ? `https://api.met.no/images/weathericons/svg/${weather.symbol}.svg`
    : null;
    
  // Affichage normal des données météo
  return (
    <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md rounded-xl px-4 py-2 shadow border border-white/20">
      {iconUrl && (
        <img
          src={iconUrl}
          alt={weather.description}
          className="w-10 h-10 drop-shadow"
          onError={e => (e.currentTarget.style.display = 'none')}
        />
      )}
      <div>
        <div className="text-lg font-bold text-white leading-tight flex items-center gap-1">
          {Math.round(weather.temp)}°C
          {usingGeolocation && <FaMapMarkerAlt className="text-jdc-yellow-200 w-3 h-3" title="Position actuelle" />}
        </div>
        <div className="text-xs text-jdc-yellow-200 font-medium">
          {weather.city} — {weather.description}
        </div>
      </div>
    </div>
  );
}; 