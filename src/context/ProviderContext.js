import { createContext, useContext, useState, useEffect } from 'react';
import { config } from '../api/config';

const ProviderContext = createContext(null);

export const PROVIDER_META = {
  groq: {
    id: 'groq',
    name: 'Groq',
    model: 'Llama 3.3 70B',
    badge: '⚡',
    speed: 'Fastest',
    color: '#f55036',
    description: 'Ultra fast. Best for live interviews.',
    free: true
  },
  gemini: {
    id: 'gemini',
    name: 'Gemini',
    model: 'Gemini 2.0 Flash',
    badge: '✨',
    speed: 'Fast',
    color: '#4285f4',
    description: 'Google AI. Great quality answers.',
    free: true
  }
};

export const ProviderProvider = ({ children }) => {
  const [activeProvider, setActiveProvider] = useState(
    () => localStorage.getItem('aria_provider') ||
          process.env.REACT_APP_DEFAULT_PROVIDER ||
          'groq'
  );
  const [availableProviders, setAvailableProviders] = useState([]);
  const [providerLoading, setProviderLoading] = useState(false);
  const [lastUsedProvider, setLastUsedProvider] = useState(null);

  // Fetch available providers from server on mount
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const res = await fetch(`${config.apiUrl}/providers`);
        const data = await res.json();
        setAvailableProviders(data.available || []);
        // If saved provider not available use server default
        const savedProvider = localStorage.getItem('aria_provider');
        if (savedProvider && !data.available.find(p => p.id === savedProvider)) {
          switchProvider(data.default || 'groq');
        }
      } catch (e) {
        // Server not responding — show both as available
        setAvailableProviders(Object.values(PROVIDER_META));
      }
    };
    fetchProviders();
  }, []);

  const switchProvider = (providerId) => {
    setActiveProvider(providerId);
    localStorage.setItem('aria_provider', providerId);
  };

  const getActiveProviderMeta = () =>
    PROVIDER_META[activeProvider] || PROVIDER_META.groq;

  return (
    <ProviderContext.Provider value={{
      activeProvider,
      availableProviders,
      providerLoading,
      lastUsedProvider,
      setLastUsedProvider,
      switchProvider,
      getActiveProviderMeta,
      PROVIDER_META
    }}>
      {children}
    </ProviderContext.Provider>
  );
};

export const useProvider = () => {
  const ctx = useContext(ProviderContext);
  if (!ctx) throw new Error('useProvider must be inside ProviderProvider');
  return ctx;
};

export default ProviderContext;
