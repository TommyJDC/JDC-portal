import { useState, useEffect } from 'react';

export default function BucketsRoute() {
  const [buckets, setBuckets] = useState([]);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBuckets = async () => {
      try {
        const response = await fetch('/.netlify/functions/google-buckets');
        if (!response.ok) {
          throw new Error('HTTP error! status: ' + response.status);
        }
        const data = await response.json();
        setBuckets(data.buckets || []);
      } catch (e: any) { // Explicitly type e as any to avoid TS error
        setError(e instanceof Error ? e : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    };

    fetchBuckets();
  }, []);

  if (loading) {
    return <p>Chargement des buckets...</p>;
  }

  if (error) {
    return <p>Erreur: {error.message}</p>;
  }

  return (
    <div>
      <h1>Liste des Buckets Google Storage</h1>
      <ul>
        {buckets.map((bucket, index) => (
          <li key={index}>{bucket}</li>
        ))}
      </ul>
    </div>
  );
}
