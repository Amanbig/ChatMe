import { useState, useCallback, useRef, useEffect } from 'react';

interface UseTextToSpeechOptions {
  voice?: SpeechSynthesisVoice | null;
  rate?: number;
  pitch?: number;
  volume?: number;
  lang?: string;
}

interface UseTextToSpeechReturn {
  speak: (text: string) => void;
  cancel: () => void;
  pause: () => void;
  resume: () => void;
  speaking: boolean;
  supported: boolean;
  voices: SpeechSynthesisVoice[];
  selectedVoice: SpeechSynthesisVoice | null;
  setSelectedVoice: (voice: SpeechSynthesisVoice | null) => void;
  rate: number;
  setRate: (rate: number) => void;
  pitch: number;
  setPitch: (pitch: number) => void;
  volume: number;
  setVolume: (volume: number) => void;
}

export const useTextToSpeech = (
  options: UseTextToSpeechOptions = {}
): UseTextToSpeechReturn => {
  const {
    voice: initialVoice = null,
    rate: initialRate = 1,
    pitch: initialPitch = 1,
    volume: initialVolume = 1,
    lang = 'en-US'
  } = options;

  const [speaking, setSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(initialVoice);
  const [rate, setRate] = useState(initialRate);
  const [pitch, setPitch] = useState(initialPitch);
  const [volume, setVolume] = useState(initialVolume);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Check if speech synthesis is supported
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  // Load available voices
  useEffect(() => {
    if (!supported) return;

    const loadVoices = () => {
      const availableVoices = speechSynthesis.getVoices();
      setVoices(availableVoices);
      
      // Auto-select a good default voice if none selected
      if (!selectedVoice && availableVoices.length > 0) {
        // Try to find an English voice first
        const englishVoice = availableVoices.find(voice => 
          voice.lang.startsWith('en') && voice.localService
        );
        
        if (englishVoice) {
          setSelectedVoice(englishVoice);
        } else {
          // Fallback to first available voice
          setSelectedVoice(availableVoices[0]);
        }
      }
    };

    // Load voices immediately
    loadVoices();

    // Listen for voice changes (some browsers load voices asynchronously)
    speechSynthesis.addEventListener('voiceschanged', loadVoices);

    return () => {
      speechSynthesis.removeEventListener('voiceschanged', loadVoices);
    };
  }, [supported, selectedVoice]);

  const speak = useCallback((text: string) => {
    if (!supported || !text.trim()) {
      console.warn('Speech synthesis not supported or empty text provided');
      return;
    }

    // Cancel any ongoing speech
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Set voice properties
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;
    utterance.lang = lang;

    // Set up event listeners
    utterance.onstart = () => {
      setSpeaking(true);
    };

    utterance.onend = () => {
      setSpeaking(false);
    };

    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event.error);
      setSpeaking(false);
    };

    utterance.onpause = () => {
      setSpeaking(false);
    };

    utterance.onresume = () => {
      setSpeaking(true);
    };

    utteranceRef.current = utterance;
    speechSynthesis.speak(utterance);
  }, [supported, selectedVoice, rate, pitch, volume, lang]);

  const cancel = useCallback(() => {
    if (!supported) return;
    speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  const pause = useCallback(() => {
    if (!supported) return;
    speechSynthesis.pause();
    setSpeaking(false);
  }, [supported]);

  const resume = useCallback(() => {
    if (!supported) return;
    speechSynthesis.resume();
    setSpeaking(true);
  }, [supported]);

  return {
    speak,
    cancel,
    pause,
    resume,
    speaking,
    supported,
    voices,
    selectedVoice,
    setSelectedVoice,
    rate,
    setRate,
    pitch,
    setPitch,
    volume,
    setVolume
  };
};
