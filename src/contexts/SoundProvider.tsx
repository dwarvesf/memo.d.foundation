'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';

interface SoundContextType {
  isSoundEnabled: boolean;
  setIsSoundEnabled: (enabled: boolean) => void;
  playPaperRubbing: () => void;
  playSharpClick: () => void;
  playSlide: () => void;
  playPop: () => void;
  playButtonUp: () => void;
  playButtonDown: () => void;
  toggleSound: () => void;
}

const SoundContext = createContext<SoundContextType | undefined>(undefined);

interface SoundProviderProps {
  children: React.ReactNode;
}

export const SoundProvider: React.FC<SoundProviderProps> = ({ children }) => {
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [audioPool, setAudioPool] = useState<
    Record<string, HTMLAudioElement[]>
  >({});
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize audio pool with multiple instances for overlapping sounds
  const initializeAudio = useCallback(() => {
    if (typeof window === 'undefined') return;

    const sounds = {
      paperRubbing: '/sound/paper_rubbing.m4a',
      sharpClick: '/sound/sharp_click.m4a',
      slide: '/sound/slide.m4a',
      pop: '/sound/pop.m4a',
      buttonUp: '/sound/button_up.m4a',
      buttonDown: '/sound/button_down.m4a',
    };

    const pool: Record<string, HTMLAudioElement[]> = {};

    Object.entries(sounds).forEach(([key, src]) => {
      pool[key] = [];
      // Create 3 instances of each sound for overlapping playback
      for (let i = 0; i < 3; i++) {
        const audio = new Audio(src);
        audio.volume = 0.4;
        audio.preload = 'auto';

        // Handle loading errors gracefully
        audio.addEventListener('error', () => {
          console.warn(`Failed to load sound: ${src}`);
        });

        pool[key].push(audio);
      }
    });

    setAudioPool(pool);
    setIsInitialized(true);
  }, []);

  // Load sound preference from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedPreference = localStorage.getItem('soundEnabled');
      if (savedPreference !== null) {
        setIsSoundEnabled(JSON.parse(savedPreference));
      }

      // Check for reduced motion preference
      const prefersReducedMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches;
      if (prefersReducedMotion && savedPreference === null) {
        setIsSoundEnabled(false);
      }

      initializeAudio();
    }
  }, [initializeAudio]);

  // Save sound preference to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('soundEnabled', JSON.stringify(isSoundEnabled));
    }
  }, [isSoundEnabled]);

  // Generic sound player with pooling
  const playSound = useCallback(
    (soundKey: string) => {
      if (!isSoundEnabled || !isInitialized || !audioPool[soundKey]) return;

      try {
        // Find an available audio instance (not currently playing)
        const availableAudio = audioPool[soundKey].find(audio => audio.paused);
        const audioToPlay = availableAudio || audioPool[soundKey][0];

        if (audioToPlay) {
          audioToPlay.currentTime = 0; // Reset to start
          audioToPlay.play().catch(() => {
            // Silently handle autoplay restrictions
          });
        }
      } catch {
        // Silently handle any playback errors
      }
    },
    [isSoundEnabled, isInitialized, audioPool],
  );

  // Debounced sound players to prevent overlapping similar sounds
  const debouncedPlayers = useCallback(() => {
    const debounceMap = new Map<string, NodeJS.Timeout>();

    return {
      playPaperRubbing: () => {
        const key = 'paperRubbing';
        if (debounceMap.has(key)) {
          clearTimeout(debounceMap.get(key)!);
        }
        debounceMap.set(
          key,
          setTimeout(() => {
            playSound(key);
            debounceMap.delete(key);
          }, 50),
        );
      },
      playSharpClick: () => playSound('sharpClick'),
      playSlide: () => {
        const key = 'slide';
        if (debounceMap.has(key)) {
          clearTimeout(debounceMap.get(key)!);
        }
        debounceMap.set(
          key,
          setTimeout(() => {
            playSound(key);
            debounceMap.delete(key);
          }, 100),
        );
      },
      playPop: () => playSound('pop'),
      playButtonUp: () => playSound('buttonUp'),
      playButtonDown: () => playSound('buttonDown'),
    };
  }, [playSound]);

  const soundPlayers = debouncedPlayers();

  const toggleSound = useCallback(() => {
    setIsSoundEnabled(prev => !prev);
  }, []);

  const contextValue: SoundContextType = {
    isSoundEnabled,
    setIsSoundEnabled,
    toggleSound,
    ...soundPlayers,
  };

  return (
    <SoundContext.Provider value={contextValue}>
      {children}
    </SoundContext.Provider>
  );
};

export const useSoundContext = (): SoundContextType => {
  const context = useContext(SoundContext);
  if (context === undefined) {
    throw new Error('useSoundContext must be used within a SoundProvider');
  }
  return context;
};
