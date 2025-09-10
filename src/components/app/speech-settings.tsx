import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Button } from "../ui/button";
import { useTextToSpeech } from "../../hooks/use-text-to-speech";
import { FaPlay, FaStop, FaVolumeUp } from "react-icons/fa";

interface SpeechSettingsProps {
  speechEnabled: boolean;
  onSpeechEnabledChange: (enabled: boolean) => void;
  autoSpeak: boolean;
  onAutoSpeakChange: (enabled: boolean) => void;
}

export default function SpeechSettings({
  speechEnabled,
  onSpeechEnabledChange,
  autoSpeak,
  onAutoSpeakChange
}: SpeechSettingsProps) {
  const {
    speak,
    cancel,
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
  } = useTextToSpeech();

  const [testText] = useState("Hello! This is a test of the text-to-speech functionality.");

  const handleTestSpeech = () => {
    if (speaking) {
      cancel();
    } else {
      speak(testText);
    }
  };

  const handleVoiceChange = (voiceURI: string) => {
    const voice = voices.find(v => v.voiceURI === voiceURI);
    if (voice) {
      setSelectedVoice(voice);
    }
  };

  if (!supported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FaVolumeUp className="h-5 w-5" />
            Speech Settings
          </CardTitle>
          <CardDescription>
            Text-to-speech is not supported in your browser.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FaVolumeUp className="h-5 w-5" />
          Speech Settings
        </CardTitle>
        <CardDescription>
          Configure speech recognition and text-to-speech settings
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable Speech Recognition */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="speech-recognition">Speech Recognition</Label>
            <div className="text-sm text-muted-foreground">
              Enable voice input using your microphone
            </div>
          </div>
          <Switch
            id="speech-recognition"
            checked={speechEnabled}
            onCheckedChange={onSpeechEnabledChange}
          />
        </div>

        {/* Auto-speak AI responses */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="auto-speak">Auto-speak AI Responses</Label>
            <div className="text-sm text-muted-foreground">
              Automatically read AI responses aloud
            </div>
          </div>
          <Switch
            id="auto-speak"
            checked={autoSpeak}
            onCheckedChange={onAutoSpeakChange}
          />
        </div>

        {/* Voice Selection */}
        <div className="space-y-3">
          <Label>Voice</Label>
          <Select
            value={selectedVoice?.voiceURI || ''}
            onValueChange={handleVoiceChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a voice" />
            </SelectTrigger>
            <SelectContent>
              {voices.map((voice) => (
                <SelectItem key={voice.voiceURI} value={voice.voiceURI}>
                  {voice.name} ({voice.lang})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Speech Rate */}
        <div className="space-y-3">
          <Label htmlFor="speech-rate">Speech Rate: {rate.toFixed(1)}x</Label>
          <input
            id="speech-rate"
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            value={rate}
            onChange={(e) => setRate(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
            aria-label={`Speech rate: ${rate.toFixed(1)}x`}
          />
        </div>

        {/* Speech Pitch */}
        <div className="space-y-3">
          <Label htmlFor="speech-pitch">Speech Pitch: {pitch.toFixed(1)}</Label>
          <input
            id="speech-pitch"
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={pitch}
            onChange={(e) => setPitch(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
            aria-label={`Speech pitch: ${pitch.toFixed(1)}`}
          />
        </div>

        {/* Speech Volume */}
        <div className="space-y-3">
          <Label htmlFor="speech-volume">Speech Volume: {Math.round(volume * 100)}%</Label>
          <input
            id="speech-volume"
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
            aria-label={`Speech volume: ${Math.round(volume * 100)}%`}
          />
        </div>

        {/* Test Speech */}
        <div className="pt-4">
          <Button
            onClick={handleTestSpeech}
            variant="outline"
            className="w-full"
          >
            {speaking ? (
              <>
                <FaStop className="mr-2 h-4 w-4" />
                Stop Test
              </>
            ) : (
              <>
                <FaPlay className="mr-2 h-4 w-4" />
                Test Speech
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
