import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { useTextToSpeech } from "../../hooks/use-text-to-speech";
import { FaPlay, FaStop, FaVolumeUp, FaMicrophone, FaRobot, FaWrench } from "react-icons/fa";

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
      <Card className="border-border/60">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
              <FaVolumeUp className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <CardTitle>Speech Settings</CardTitle>
              <CardDescription>Text-to-speech is not supported in your browser.</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main Controls Card */}
      <Card className="border-border/60">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <FaVolumeUp className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle>Speech Settings</CardTitle>
              <CardDescription>Configure voice input and text-to-speech</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Speech Recognition */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <FaMicrophone className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <Label htmlFor="speech-recognition" className="text-base font-medium">Speech Recognition</Label>
                <p className="text-xs text-muted-foreground">Enable voice input using your microphone</p>
              </div>
            </div>
            <Switch
              id="speech-recognition"
              checked={speechEnabled}
              onCheckedChange={onSpeechEnabledChange}
            />
          </div>

          {/* Auto-speak */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <FaRobot className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <Label htmlFor="auto-speak" className="text-base font-medium">Auto-speak AI Responses</Label>
                <p className="text-xs text-muted-foreground">Automatically read AI responses aloud</p>
              </div>
            </div>
            <Switch
              id="auto-speak"
              checked={autoSpeak}
              onCheckedChange={onAutoSpeakChange}
            />
          </div>
        </CardContent>
      </Card>

      {/* Voice Settings Card */}
      <Card className="border-border/60">
        <CardHeader>
          <div className="flex items-center gap-2">
            <FaWrench className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Voice Configuration</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Voice Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Voice</Label>
            <Select
              value={selectedVoice?.voiceURI || ''}
              onValueChange={handleVoiceChange}
            >
              <SelectTrigger className="w-full">
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
            <p className="text-xs text-muted-foreground">
              {voices.length} voices available
            </p>
          </div>

          {/* Sliders Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Rate */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Speed</Label>
                <Badge variant="secondary" className="text-[10px]">{rate.toFixed(1)}x</Badge>
              </div>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={rate}
                onChange={(e) => setRate(parseFloat(e.target.value))}
                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Slow</span>
                <span>Fast</span>
              </div>
            </div>

            {/* Pitch */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Pitch</Label>
                <Badge variant="secondary" className="text-[10px]">{pitch.toFixed(1)}</Badge>
              </div>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={pitch}
                onChange={(e) => setPitch(parseFloat(e.target.value))}
                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Low</span>
                <span>High</span>
              </div>
            </div>

            {/* Volume */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Volume</Label>
                <Badge variant="secondary" className="text-[10px]">{Math.round(volume * 100)}%</Badge>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Quiet</span>
                <span>Loud</span>
              </div>
            </div>
          </div>

          {/* Test Button */}
          <div className="pt-4 border-t border-border/50">
            <Button
              onClick={handleTestSpeech}
              variant={speaking ? "destructive" : "default"}
              className="w-full gap-2"
            >
              {speaking ? (
                <>
                  <FaStop className="h-4 w-4" />
                  Stop Test
                </>
              ) : (
                <>
                  <FaPlay className="h-4 w-4" />
                  Test Speech
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
