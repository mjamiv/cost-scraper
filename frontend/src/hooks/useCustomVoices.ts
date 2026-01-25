import { useState, useEffect, useCallback } from 'react';

export interface CustomVoice {
  id: string;          // voice_abc123 from OpenAI
  name: string;        // User-provided name
  createdAt: string;   // ISO date string
  languageTag: string; // BCP 47 format (e.g., en-US)
}

const STORAGE_KEY = 'custom_voices';

function loadVoicesFromStorage(): CustomVoice[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error loading custom voices from storage:', err);
  }
  return [];
}

function saveVoicesToStorage(voices: CustomVoice[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(voices));
  } catch (err) {
    console.error('Error saving custom voices to storage:', err);
  }
}

export interface UseCustomVoicesReturn {
  voices: CustomVoice[];
  addVoice: (voice: Omit<CustomVoice, 'createdAt'>) => void;
  removeVoice: (id: string) => void;
  getVoice: (id: string) => CustomVoice | undefined;
  hasVoice: (id: string) => boolean;
  clearAll: () => void;
}

export function useCustomVoices(): UseCustomVoicesReturn {
  const [voices, setVoices] = useState<CustomVoice[]>([]);

  // Load voices from storage on mount
  useEffect(() => {
    const stored = loadVoicesFromStorage();
    setVoices(stored);
  }, []);

  // Save voices to storage whenever they change
  useEffect(() => {
    if (voices.length > 0 || localStorage.getItem(STORAGE_KEY)) {
      saveVoicesToStorage(voices);
    }
  }, [voices]);

  const addVoice = useCallback((voice: Omit<CustomVoice, 'createdAt'>) => {
    const newVoice: CustomVoice = {
      ...voice,
      createdAt: new Date().toISOString(),
    };

    setVoices(prev => {
      // Don't add duplicates
      if (prev.some(v => v.id === voice.id)) {
        console.warn(`Voice with id ${voice.id} already exists`);
        return prev;
      }
      return [...prev, newVoice];
    });
  }, []);

  const removeVoice = useCallback((id: string) => {
    setVoices(prev => prev.filter(v => v.id !== id));
  }, []);

  const getVoice = useCallback((id: string) => {
    return voices.find(v => v.id === id);
  }, [voices]);

  const hasVoice = useCallback((id: string) => {
    return voices.some(v => v.id === id);
  }, [voices]);

  const clearAll = useCallback(() => {
    setVoices([]);
  }, []);

  return {
    voices,
    addVoice,
    removeVoice,
    getVoice,
    hasVoice,
    clearAll,
  };
}
