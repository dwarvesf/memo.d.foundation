import { useSoundContext } from '@/contexts/SoundProvider';

/**
 * Custom hook for managing audio effects throughout the application.
 * Provides sound players that respect the global sound enabled state.
 *
 * @returns Object containing all sound player functions and sound state
 */
export const useAudioEffects = () => {
  const context = useSoundContext();

  return {
    // Sound state
    isSoundEnabled: context.isSoundEnabled,
    toggleSound: context.toggleSound,
    setIsSoundEnabled: context.setIsSoundEnabled,

    // Sound players for different UI interactions
    playPaperRubbing: context.playPaperRubbing, // TOC hover - organic, subtle
    playSharpClick: context.playSharpClick, // TOC click / precise actions
    playSlide: context.playSlide, // Button hover / smooth transitions
    playPop: context.playPop, // Alternative satisfying click
    playButtonUp: context.playButtonUp, // Toggle ON state
    playButtonDown: context.playButtonDown, // Toggle OFF state
  };
};
