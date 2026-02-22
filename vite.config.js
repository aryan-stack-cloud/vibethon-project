import { defineConfig } from 'vite'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Copies WASM binaries from @runanywhere npm packages into dist/assets/
 * for production builds. In dev mode Vite serves node_modules directly.
 */
function copyWasmPlugin() {
  const llamacppWasm = path.resolve(__dirname, 'node_modules/@runanywhere/web-llamacpp/wasm')
  const onnxWasm = path.resolve(__dirname, 'node_modules/@runanywhere/web-onnx/wasm')

  return {
    name: 'copy-wasm',
    writeBundle(options) {
      const outDir = options.dir ?? path.resolve(__dirname, 'dist')
      const assetsDir = path.join(outDir, 'assets')
      fs.mkdirSync(assetsDir, { recursive: true })

      // LlamaCpp WASM binaries (LLM/VLM)
      const llamacppFiles = [
        'racommons-llamacpp.wasm',
        'racommons-llamacpp.js',
        'racommons-llamacpp-webgpu.wasm',
        'racommons-llamacpp-webgpu.js',
      ]
      
      for (const file of llamacppFiles) {
        const src = path.join(llamacppWasm, file)
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, path.join(assetsDir, file))
        }
      }

      // Sherpa-ONNX: copy all files in sherpa/ subdirectory (STT/TTS/VAD)
      const sherpaDir = path.join(onnxWasm, 'sherpa')
      const sherpaOut = path.join(assetsDir, 'sherpa')
      if (fs.existsSync(sherpaDir)) {
        fs.mkdirSync(sherpaOut, { recursive: true })
        for (const file of fs.readdirSync(sherpaDir)) {
          fs.copyFileSync(path.join(sherpaDir, file), path.join(sherpaOut, file))
        }
      }
    },
  }
}

export default defineConfig({
  plugins: [copyWasmPlugin()],
  
  // Serve WASM files as static assets
  assetsInclude: ['**/*.wasm'],
  
  // Development server configuration
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
    open: true,
    port: 3000,
  },
  
  // Preview server configuration
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
    port: 3000,
  },
  
  // Build configuration
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          'runanywhere-core': ['@runanywhere/web'],
          'runanywhere-llamacpp': ['@runanywhere/web-llamacpp'],
          'runanywhere-onnx': ['@runanywhere/web-onnx'],
        },
      },
    },
  },
  
  // Web Worker configuration
  worker: {
    format: 'es'
  },
  
  // CRITICAL: exclude WASM packages from pre-bundling so import.meta.url
  // resolves correctly for automatic WASM file discovery
  optimizeDeps: {
    exclude: ['@runanywhere/web', '@runanywhere/web-llamacpp', '@runanywhere/web-onnx'],
  },
})
