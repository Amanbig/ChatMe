# Speech Features Documentation

ChatMe now includes speech recognition and text-to-speech capabilities for a more interactive voice-based chat experience.

## Features Added

### 1. Speech Recognition (Speech-to-Text)
- **Microphone Button**: Click the microphone icon in the input box to start/stop voice input
- **Real-time Transcription**: See your speech being transcribed in real-time
- **Browser Compatibility**: Uses Web Speech API (supported in Chrome, Edge, Safari)
- **Visual Feedback**: Red recording indicator when listening

### 2. Text-to-Speech (AI Response Reading)
- **Speaker Button**: Click the speaker icon next to AI messages to hear them read aloud
- **Voice Control**: Pause/resume speech playback
- **Multiple Voices**: Choose from available system voices
- **Customizable Settings**: Adjust speech rate, pitch, and volume

### 3. Speech Settings
Located in the Settings page, you can configure:
- **Enable/Disable Speech Recognition**: Toggle voice input functionality
- **Auto-speak AI Responses**: Automatically read AI responses aloud
- **Voice Selection**: Choose your preferred TTS voice
- **Speech Rate**: Control how fast the text is spoken (0.5x to 2x)
- **Speech Pitch**: Adjust voice pitch (0 to 2)
- **Speech Volume**: Set volume level (0% to 100%)

## How to Use

### Voice Input
1. Click the microphone button in the input box
2. Grant microphone permissions when prompted
3. Start speaking - you'll see the transcript appear in real-time
4. Click the microphone again to stop recording
5. The transcribed text will be added to your message
6. Send the message as usual

### Listen to AI Responses
1. After receiving an AI response, click the speaker icon next to the message
2. The message will be read aloud using the selected voice
3. Click the stop icon to pause playback

### Configure Speech Settings
1. Go to Settings page
2. Find the "Speech Settings" section at the top
3. Toggle speech recognition on/off
4. Enable auto-speak for automatic AI response reading
5. Test different voices and adjust speech parameters
6. Use the "Test Speech" button to preview your settings

## Browser Support

### Speech Recognition
- ✅ Chrome (Desktop & Mobile)
- ✅ Microsoft Edge
- ✅ Safari (Desktop & iOS)
- ❌ Firefox (not supported)

### Text-to-Speech
- ✅ Chrome (Desktop & Mobile)
- ✅ Microsoft Edge
- ✅ Safari (Desktop & iOS)
- ✅ Firefox

## Privacy & Security
- All speech processing is done locally in your browser
- No audio data is sent to external servers
- Speech recognition uses your browser's built-in capabilities
- TTS uses system voices installed on your device

## Troubleshooting

### Speech Recognition Not Working
1. Check if your browser supports Web Speech API
2. Ensure microphone permissions are granted
3. Try refreshing the page and granting permissions again
4. Check if your microphone is working in other applications

### Text-to-Speech Not Working
1. Verify that your system has TTS voices installed
2. Try selecting a different voice in settings
3. Check system volume settings
4. Ensure the browser tab has audio permissions

### Poor Recognition Accuracy
1. Speak clearly and at a moderate pace
2. Use a good quality microphone
3. Minimize background noise
4. Try speaking closer to the microphone

## Future Enhancements

### Kokoro TTS Integration
The codebase is prepared for integrating Kokoro TTS for higher quality voice synthesis:
- Replace the Web Speech API TTS with Kokoro API calls
- Better voice quality and more natural speech
- Support for multiple languages and voice styles

### Planned Features
- Wake word detection for hands-free activation
- Voice activity detection for automatic start/stop
- Custom wake phrases
- Voice commands for navigation
- Conversation mode with continuous listening

## Technical Implementation

### Components Modified
- `InputBox`: Added microphone button and speech recognition
- `MessageItem`: Added speaker button and TTS functionality
- `StreamingMessageItem`: Added TTS support for streaming messages
- `SpeechSettings`: New component for configuring speech features
- `SettingsPage`: Integrated speech settings

### New Hooks
- `useSpeechRecognition`: Web Speech API wrapper for voice input
- `useTextToSpeech`: Speech synthesis API wrapper for voice output

### Storage
- Speech settings are stored in localStorage
- Settings persist across browser sessions
- Default values provided for new users
