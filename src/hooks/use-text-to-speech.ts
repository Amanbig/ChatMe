import { useState, useCallback, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface UseTextToSpeechOptions {
  voice?: SpeechSynthesisVoice | null;
  rate?: number;
  pitch?: number;
  volume?: number;
  lang?: string;
}

interface TtsStatus {
  supported: boolean;
  engine: string;
}

interface NativeTtsVoice {
  name: string;
  lang: string;
  voice_uri: string;
}

interface UseTextToSpeechReturn {
  speak: (text: string) => void;
  cancel: () => void;
  pause: () => void;
  resume: () => void;
  speaking: boolean;
  supported: boolean;
  engine: string;
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
  const [nativeStatus, setNativeStatus] = useState<TtsStatus>({ supported: false, engine: '' });
  const [nativeVoices, setNativeVoices] = useState<NativeTtsVoice[]>([]);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const speakTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check if browser speech synthesis is supported
  const browserSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  // Check native Tauri TTS
  useEffect(() => {
    invoke<TtsStatus>('get_tts_status')
      .then((status) => {
        if (status?.supported) {
          setNativeStatus(status);
        }
      })
      .catch(() => {});

    invoke<NativeTtsVoice[]>('get_native_tts_voices')
      .then((vList) => {
        if (vList && vList.length > 0) {
          setNativeVoices(vList);
        }
      })
      .catch(() => {});
  }, []);

  const supported = browserSupported || nativeStatus.supported;
  const engine = nativeStatus.engine || (browserSupported ? 'Web Speech API' : '');

  // Load available voices
  useEffect(() => {
    if (browserSupported && typeof speechSynthesis !== 'undefined') {
      const loadVoices = () => {
        const availableVoices = speechSynthesis.getVoices();
        if (availableVoices.length > 0) {
          setVoices(availableVoices);
          if (!selectedVoice) {
            const englishVoice = availableVoices.find(voice => 
              voice.lang.startsWith('en') && voice.localService
            );
            setSelectedVoice(englishVoice || availableVoices[0]);
          }
        }
      };

      loadVoices();
      speechSynthesis.addEventListener('voiceschanged', loadVoices);
      return () => {
        speechSynthesis.removeEventListener('voiceschanged', loadVoices);
      };
    } else if (nativeVoices.length > 0) {
      const mapped = nativeVoices.map(nv => ({
        voiceURI: nv.voice_uri,
        name: nv.name,
        lang: nv.lang,
        localService: true,
        default: nv.voice_uri === 'default',
      })) as unknown as SpeechSynthesisVoice[];
      setVoices(mapped);
      if (!selectedVoice && mapped.length > 0) {
        setSelectedVoice(mapped[0]);
      }
    }
  }, [browserSupported, nativeVoices, selectedVoice]);

  const speak = useCallback((text: string) => {
    if (!text.trim()) {
      return;
    }

    if (browserSupported && typeof speechSynthesis !== 'undefined') {
      // Cancel any ongoing speech
      speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.volume = volume;
      utterance.lang = lang;

      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = (event) => {
        console.error('Speech synthesis error:', event.error);
        setSpeaking(false);
      };
      utterance.onpause = () => setSpeaking(false);
      utterance.onresume = () => setSpeaking(true);

      utteranceRef.current = utterance;
      speechSynthesis.speak(utterance);
    } else if (nativeStatus.supported) {
      if (speakTimerRef.current) {
        clearTimeout(speakTimerRef.current);
      }
      setSpeaking(true);

      invoke('native_speak', {
        text,
        voice: selectedVoice?.voiceURI || 'default',
        rate,
        pitch,
        volume
      }).catch(err => {
        console.error('Native speech error:', err);
        setSpeaking(false);
      });

      // Estimate duration to reset speaking animation
      const wordCount = text.trim().split(/\s+/).length;
      const durationMs = Math.max(1200, (wordCount / (150 * rate)) * 60 * 1000);
      speakTimerRef.current = setTimeout(() => {
        setSpeaking(false);
      }, durationMs);
    }
  }, [browserSupported, nativeStatus.supported, selectedVoice, rate, pitch, volume, lang]);

  const cancel = useCallback(() => {
    if (browserSupported && typeof speechSynthesis !== 'undefined') {
      speechSynthesis.cancel();
    }
    if (nativeStatus.supported) {
      invoke('native_cancel_speech').catch(() => {});
    }
    if (speakTimerRef.current) {
      clearTimeout(speakTimerRef.current);
    }
    setSpeaking(false);
  }, [browserSupported, nativeStatus.supported]);

  const pause = useCallback(() => {
    cancel();
  }, [cancel]);

  const resume = useCallback(() => {
    // No-op for simple native commands
  }, []);

  return {
    speak,
    cancel,
    pause,
    resume,
    speaking,
    supported,
    engine,
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
