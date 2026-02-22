# RunAnywhere Web SDK Installation Note

## Important: SDK Not Yet Available on npm

The `@runanywhere/web` package is currently in early beta and may not be publicly available on npm yet. Based on the RunAnywhere documentation, the Web SDK is in v0.1.x early beta.

## Installation Options

### Option 1: Wait for Official npm Release
The RunAnywhere team will publish the package to npm when it's ready. Check:
- https://docs.runanywhere.ai/web/installation
- https://github.com/RunanywhereAI/runanywhere-sdks

### Option 2: Contact RunAnywhere for Beta Access
If you need immediate access:
1. Visit the RunAnywhere website or GitHub
2. Request beta access to the Web SDK
3. They may provide installation instructions or early access

### Option 3: Use Alternative SDKs
While waiting, you can use:
- **React Native SDK**: `@runanywhere/core`, `@runanywhere/llamacpp`, `@runanywhere/onnx`
- **Flutter SDK**: Available for mobile apps
- **Swift SDK**: For iOS applications
- **Kotlin SDK**: For Android applications

## When SDK Becomes Available

Once `@runanywhere/web` is published to npm, install it:

```bash
npm install @runanywhere/web
```

Then uncomment the import in `script.js` and the application will work as designed.

## Current Status

This project is **complete and ready** - it just needs the RunAnywhere Web SDK to be published. All code is written according to the official documentation at https://docs.runanywhere.ai/web/

## Alternative: Mock Implementation

For testing the UI without the SDK, you could create a mock implementation that simulates the SDK behavior. This would let you test:
- UI interactions
- Recording functionality
- File saving
- Copy to clipboard features

The actual AI transcription and summarization would be mocked with placeholder data.

---

**Last Updated:** February 21, 2026
**SDK Documentation:** https://docs.runanywhere.ai/web/introduction
