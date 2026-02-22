# Offline Meeting Assistant

A fully offline-capable meeting assistant web application that uses on-device AI for speech-to-text transcription and meeting summarization. Your data never leaves your device.

## Features

- **🎤 Audio Recording:** Record meeting conversations directly from your microphone
- **📝 Speech-to-Text:** Transcribe audio using on-device Whisper models (via RunAnywhere STT)
- **✨ AI Summarization:** Generate concise summaries and extract action items using on-device LLM
- **🔒 100% Private:** All processing happens in your browser - no data ever leaves your device
- **📴 Offline Ready:** After initial model download, works completely offline
- **💾 Save Results:** Export transcripts and summaries as text files
- **📋 Copy to Clipboard:** Easily copy transcripts and summaries

## Technical Stack

- **Frontend:** Pure HTML5, CSS3, and Vanilla JavaScript (ES6 modules)
- **AI SDK:** RunAnywhere Web SDK (@runanywhere/web)
- **STT Model:** Whisper-tiny (~75MB)
- **LLM Model:** Qwen2.5-0.5B-Instruct (~350MB)
- **Build Tool:** Vite
- **Storage:** OPFS (Origin Private File System) for model caching

## System Requirements

### Browser Requirements

| Browser | Minimum Version | Status |
|---------|----------------|--------|
| Chrome/Edge | 96+ | ✅ Fully Supported |
| Firefox | 119+ | ✅ Supported (no WebGPU) |
| Safari | 17+ | ⚠️ Limited (OPFS issues) |

### Required Browser Features
- ✅ WebAssembly support
- ✅ OPFS (Origin Private File System)
- ✅ MediaRecorder API
- ⚠️ SharedArrayBuffer (recommended for better performance)

### Hardware Requirements
- **RAM:** Minimum 2GB, Recommended 4GB+
- **Storage:** ~500MB free space for models
- **Internet:** Required only for initial model download

## Installation

### 1. Clone or Download

```bash
cd offline-meeting-assistant
```

### 2. Install Dependencies

```bash
npm install
```

This will install:
- `@runanywhere/web` - RunAnywhere Web SDK
- `vite` - Development server and build tool

### 3. Start Development Server

```bash
npm run dev
```

The app will automatically open in your browser at `http://localhost:3000`

### 4. Build for Production

```bash
npm run build
```

The optimized production build will be in the `dist/` folder.

### 5. Preview Production Build

```bash
npm run preview
```

## First Run Setup

### Model Download

On first run, the app will download two AI models:

1. **STT Model (Whisper-tiny):** ~75MB
2. **LLM Model (Qwen2.5-0.5B-Instruct):** ~350MB

**Total Download:** ~425MB

These models are cached in your browser's OPFS and only need to be downloaded once. After caching, the app works completely offline.

### Progress Tracking

The UI shows real-time download progress with:
- Percentage complete
- Downloaded MB / Total MB
- Estimated time remaining

## Usage Guide

### Recording a Meeting

1. **Grant Microphone Permission:** Click "Allow" when prompted
2. **Start Recording:** Click the "🎙️ Start Recording" button
3. **Speak Naturally:** The app records for up to 30 minutes
4. **Stop Recording:** Click "⏹️ Stop Recording" when done

### Viewing Results

After stopping the recording:

1. **Transcription:** The app automatically transcribes your audio
2. **Summarization:** AI generates a summary and extracts action items
3. **Review:** Check the transcript and summary for accuracy

### Saving Results

- **Save as File:** Click "💾 Save Results" to download a text file
- **Copy Transcript:** Click 📋 next to the transcript section
- **Copy Summary:** Click 📋 next to the summary section

### Starting Over

Click "🎙️ New Recording" to reset and start a fresh recording session.

## Offline Usage

### Testing Offline Functionality

1. **First Run:** Complete the initial model download with internet connected
2. **Wait for "Offline Ready":** Ensure status shows "✓ Offline Ready"
3. **Disconnect Internet:** Turn off Wi-Fi or unplug ethernet
4. **Test Recording:** Make a test recording - it should work perfectly!

### Verifying Offline Status

Look for these indicators:
- ✅ "Models: ✓ Offline Ready" in the control panel
- ✅ No network requests in browser DevTools
- ✅ Models cached in OPFS

## Project Structure

```
offline-meeting-assistant/
├── index.html          # Main HTML structure
├── style.css           # Complete styling
├── script.js           # Application logic and SDK integration
├── vite.config.js      # Vite configuration (WASM + COOP/COEP headers)
├── package.json        # Dependencies and scripts
└── README.md           # This file
```

## Configuration

### Cross-Origin Isolation

For optimal performance (multi-threaded WASM), the app requires Cross-Origin Isolation headers:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: credentialless
```

These are automatically configured in `vite.config.js` for the development server.

### Recording Duration Limit

Default: 30 minutes

To change, edit `MAX_RECORDING_DURATION_MS` in `script.js`:

```javascript
const MAX_RECORDING_DURATION_MS = 30 * 60 * 1000; // 30 minutes in milliseconds
```

### Audio Settings

Audio is recorded at:
- **Sample Rate:** 16kHz (required for Whisper)
- **Channels:** Mono (1 channel)
- **Echo Cancellation:** Enabled
- **Noise Suppression:** Enabled

## Troubleshooting

### "Browser does not support OPFS"

**Solution:** Use Chrome/Edge 96+ or Firefox 119+. Safari has limited OPFS support.

### "Microphone Access Denied"

**Solution:**
1. Check browser permissions settings
2. Ensure you're using HTTPS or localhost
3. Grant microphone permission when prompted

### Models Not Downloading

**Solution:**
1. Check internet connection
2. Clear browser cache and reload
3. Check browser console for errors
4. Ensure ~500MB free disk space

### Performance Issues

**Solution:**
1. Close other browser tabs
2. Ensure 4GB+ RAM available
3. Check if Cross-Origin Isolation is working (see browser console)
4. Try a shorter recording duration

### Transcription Errors

**Solution:**
1. Speak clearly and avoid background noise
2. Use an external microphone for better quality
3. Keep recordings under 15 minutes for best results
4. Ensure proper audio input device selected

### Summary Generation Fails

**Solution:**
1. Ensure transcript is not empty
2. Try with a longer/more substantial transcript
3. Check browser console for errors
4. Verify LLM model loaded correctly

## Privacy & Security

### Data Privacy

- ✅ **All processing is local:** Audio, transcripts, and summaries never leave your device
- ✅ **No API keys required:** No cloud services involved
- ✅ **No telemetry:** The app doesn't track or report usage
- ✅ **No external requests:** After model download, zero network activity
- ✅ **Sandboxed storage:** Models stored in browser's OPFS (isolated per origin)

### Security Features

- 🔒 Cross-Origin Isolation for enhanced security
- 🔒 HTTPS recommended for production deployment
- 🔒 No data collection or analytics
- 🔒 No cookies or tracking

## Deployment

### Deploy to Vercel

1. Install Vercel CLI: `npm i -g vercel`
2. Run: `vercel`
3. Configure headers in `vercel.json`:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
        { "key": "Cross-Origin-Embedder-Policy", "value": "require-corp" }
      ]
    }
  ]
}
```

### Deploy to Netlify

1. Build: `npm run build`
2. Deploy `dist/` folder
3. Add `netlify.toml`:

```toml
[[headers]]
  for = "/*"
  [headers.values]
    Cross-Origin-Opener-Policy = "same-origin"
    Cross-Origin-Embedder-Policy = "require-corp"
```

### Deploy to GitHub Pages

**Note:** GitHub Pages doesn't support custom headers. Use Vercel or Netlify instead for full functionality.

## Development

### Running in Development Mode

```bash
npm run dev
```

Features:
- Hot module reloading
- Source maps for debugging
- COOP/COEP headers automatically configured

### Building for Production

```bash
npm run build
```

Outputs optimized bundle to `dist/`:
- Minified JavaScript
- Optimized CSS
- Proper WASM handling
- Source maps

### Testing Changes

1. Make changes to `script.js`, `style.css`, or `index.html`
2. Vite automatically reloads the browser
3. Check browser console for errors
4. Test with actual microphone input

## Technical Details

### Audio Processing Pipeline

```
Microphone → MediaRecorder → Blob → 
AudioContext → AudioBuffer → Float32Array (16kHz mono) →
RunAnywhere STT → Transcript Text
```

### Audio Conversion

The app automatically:
- Converts stereo to mono (averages channels)
- Resamples to 16kHz (required for Whisper)
- Handles various input formats (webm, ogg, etc.)

### Model Management

Models are:
1. Downloaded from HuggingFace
2. Stored in browser OPFS
3. Loaded into memory on app start
4. Persisted across sessions

### LLM Prompt Engineering

The summarization prompt is structured to:
1. Request a concise 2-3 sentence summary
2. Extract action items in bullet format
3. Include responsible parties when mentioned
4. Follow a consistent format for parsing

## Known Limitations

- **Maximum Recording:** 30 minutes (configurable)
- **Model Size:** ~425MB total download
- **Browser Support:** Best on Chrome/Edge 120+
- **Memory Usage:** ~2GB RAM minimum
- **Audio Quality:** Depends on microphone and environment
- **Accuracy:** Whisper-tiny is fast but less accurate than larger models

## Future Enhancements

Potential improvements:
- [ ] Support for larger Whisper models (better accuracy)
- [ ] Real-time streaming transcription
- [ ] Multiple language support
- [ ] Speaker diarization (identify different speakers)
- [ ] Cloud backup option (opt-in)
- [ ] Export to PDF/Word formats
- [ ] Meeting template customization

## Resources

- [RunAnywhere Web SDK Documentation](https://docs.runanywhere.ai/web/introduction)
- [Whisper Models](https://github.com/openai/whisper)
- [Qwen2.5 Models](https://huggingface.co/Qwen)
- [OPFS Documentation](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system)

## License

MIT License - See LICENSE file for details

## Support

For issues or questions:
1. Check this README's troubleshooting section
2. Review browser console for error messages
3. Ensure system requirements are met
4. Check RunAnywhere SDK documentation

## Acknowledgments

- **RunAnywhere** for the excellent on-device AI SDK
- **OpenAI Whisper** for the speech-to-text models
- **Qwen Team** for the efficient LLM models
- **Modern browsers** for enabling powerful web applications

---

**Built with ❤️ for privacy-conscious users who value on-device AI processing.**
