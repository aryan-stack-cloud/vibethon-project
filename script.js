/**
 * Offline Meeting Assistant
 * Complete implementation with RunAnywhere Web SDK
 */

import { RunAnywhere, SDKEnvironment, ModelManager, ModelCategory, LLMFramework, EventBus } from '@runanywhere/web';
import { LlamaCPP, TextGeneration } from '@runanywhere/web-llamacpp';
import { ONNX, STT, STTModelType, SherpaONNXBridge } from '@runanywhere/web-onnx';

const MAX_RECORDING_DURATION_MS = 30 * 60 * 1000;
const AUDIO_SAMPLE_RATE = 16000;
const MODEL_CONFIG = {
  stt: { 
    id: 'whisper-tiny',
    name: 'Whisper Tiny',
    // Direct URLs to sherpa-onnx Whisper model files
    urls: {
      encoder: 'https://huggingface.co/csukuangfj/sherpa-onnx-whisper-tiny/resolve/main/tiny-encoder.onnx',
      decoder: 'https://huggingface.co/csukuangfj/sherpa-onnx-whisper-tiny/resolve/main/tiny-decoder.onnx',
      tokens: 'https://huggingface.co/csukuangfj/sherpa-onnx-whisper-tiny/resolve/main/tiny-tokens.txt'
    },
    estimatedSize: 75 
  },
  llm: { 
    id: 'lfm2-350m',
    name: 'LFM2 350M',
    repo: 'LiquidAI/LFM2-350M-GGUF',
    file: 'LFM2-350M-Q4_K_M.gguf',
    estimatedSize: 250 
  }
};

const AppState = {
  isInitialized: false,
  modelsReady: false,
  isRecording: false,
  isProcessing: false,
  mediaRecorder: null,
  audioChunks: [],
  recordingStartTime: null,
  recordingTimer: null,
  audioBlob: null,
  transcriptText: '',
  summaryData: null
};

const DOM = {
  statusIndicator: document.getElementById('statusIndicator'),
  statusText: document.getElementById('statusText'),
  modelsStatus: document.getElementById('modelsStatus'),
  modelsText: document.getElementById('modelsText'),
  downloadProgress: document.getElementById('downloadProgress'),
  sttProgress: document.getElementById('sttProgress'),
  sttProgressBar: document.getElementById('sttProgressBar'),
  sttSize: document.getElementById('sttSize'),
  llmProgress: document.getElementById('llmProgress'),
  llmProgressBar: document.getElementById('llmProgressBar'),
  llmSize: document.getElementById('llmSize'),
  recordButton: document.getElementById('recordButton'),
  recordIcon: document.getElementById('recordIcon'),
  recordText: document.getElementById('recordText'),
  durationContainer: document.getElementById('durationContainer'),
  currentDuration: document.getElementById('currentDuration'),
  durationBar: document.getElementById('durationBar'),
  actionButtons: document.getElementById('actionButtons'),
  newRecordingButton: document.getElementById('newRecordingButton'),
  saveResultsButton: document.getElementById('saveResultsButton'),
  transcriptPlaceholder: document.getElementById('transcriptPlaceholder'),
  transcriptContent: document.getElementById('transcriptContent'),
  copyTranscriptBtn: document.getElementById('copyTranscriptBtn'),
  summaryPlaceholder: document.getElementById('summaryPlaceholder'),
  summaryContent: document.getElementById('summaryContent'),
  summaryText: document.getElementById('summaryText'),
  actionItemsList: document.getElementById('actionItemsList'),
  copySummaryBtn: document.getElementById('copySummaryBtn'),
  errorModal: document.getElementById('errorModal'),
  errorMessage: document.getElementById('errorMessage'),
  modalClose: document.getElementById('modalClose'),
  modalOkButton: document.getElementById('modalOkButton'),
  toast: document.getElementById('toast'),
  toastIcon: document.getElementById('toastIcon'),
  toastMessage: document.getElementById('toastMessage')
};

let _initPromise = null;

async function initializeApp() {
  if (_initPromise) return _initPromise;
  
  _initPromise = (async () => {
    try {
      updateStatus('Initializing SDK...', 'processing');
      
      // Step 1: Initialize core SDK
      await RunAnywhere.initialize({
        environment: SDKEnvironment.Development,
        debug: true
      });
      
      // Step 2: Register backends
      updateModelsStatus('Registering LLM backend...', true);
      await LlamaCPP.register();
      
      updateModelsStatus('Registering STT backend...', true);
      await ONNX.register();
      
      // Step 3: Configure Sherpa-ONNX WASM URL
      // This is required for STT to work
      // Use bare module specifier that Vite will resolve
      SherpaONNXBridge.shared.wasmUrl = new URL(
        '@runanywhere/web-onnx/wasm/sherpa/sherpa-onnx-glue.js',
        import.meta.url
      ).href;
      
      // Ensure Sherpa-ONNX WASM is loaded
      await SherpaONNXBridge.shared.ensureLoaded();
      
      AppState.isInitialized = true;
      
      // Step 4: Register model catalog
      await registerModels();
      
      // Step 5: Setup event listeners
      setupEventListeners();
      
      // Step 6: Load models
      await loadModels();
      
      updateStatus('Ready to Record', 'ready');
      DOM.recordButton.disabled = false;
      DOM.recordText.textContent = 'Start Recording';
      DOM.recordIcon.textContent = '🎙️';
      
    } catch (error) {
      console.error('Initialization error:', error);
      showError('Initialization Failed', error.message);
      updateStatus('Initialization Failed', 'error');
    }
  })();
  
  return _initPromise;
}

async function registerModels() {
  // Register only LLM model with ModelManager (STT uses direct loading)
  RunAnywhere.registerModels([
    {
      id: MODEL_CONFIG.llm.id,
      name: MODEL_CONFIG.llm.name,
      repo: MODEL_CONFIG.llm.repo,
      files: [MODEL_CONFIG.llm.file],
      framework: LLMFramework.LlamaCpp,
      modality: ModelCategory.Language,
      memoryRequirement: 250_000_000
    }
  ]);
}

async function loadModels() {
  try {
    updateModelsStatus('Checking models...', true);
    
    // Get all registered models
    const models = ModelManager.getModels();
    const llmModel = models.find(m => m.id === MODEL_CONFIG.llm.id);
    
    // Check if LLM model needs to be downloaded
    if (llmModel && llmModel.status !== 'downloaded' && llmModel.status !== 'loaded') {
      DOM.downloadProgress.classList.remove('hidden');
      await downloadLLMModelWithProgress();
    }
    
    // Load LLM model
    updateModelsStatus('Loading LLM model...', true);
    await ModelManager.loadModel(MODEL_CONFIG.llm.id);
    
    // Load STT model directly using URLs
    updateModelsStatus('Loading STT model...', true);
    await STT.loadModel({
      modelId: MODEL_CONFIG.stt.id,
      type: STTModelType.Whisper,
      modelFiles: MODEL_CONFIG.stt.urls,
      sampleRate: AUDIO_SAMPLE_RATE,
      language: 'en'
    });
    
    AppState.modelsReady = true;
    updateModelsStatus('✓ Offline Ready', false);
    DOM.downloadProgress.classList.add('hidden');
    
  } catch (error) {
    console.error('Model loading error:', error);
    throw new Error('Failed to load models: ' + error.message);
  }
}

async function downloadLLMModelWithProgress() {
  return new Promise((resolve, reject) => {
    let llmComplete = false;
    
    // Track download progress
    EventBus.shared.on('model.downloadProgress', (event) => {
      const { modelId, progress, bytesDownloaded, totalBytes } = event;
      
      if (modelId === MODEL_CONFIG.llm.id) {
        const percent = Math.round((progress || 0) * 100);
        const downloadedMB = Math.round((bytesDownloaded || 0) / 1024 / 1024);
        const totalMB = Math.round((totalBytes || 0) / 1024 / 1024);
        
        DOM.llmProgress.textContent = percent + '%';
        DOM.llmProgressBar.style.width = percent + '%';
        DOM.llmSize.textContent = downloadedMB + ' MB / ' + totalMB + ' MB';
        
        // Simulate STT progress (since STT uses direct URLs)
        const sttPercent = Math.min(percent, 100);
        const sttDownloadedMB = Math.round((sttPercent / 100) * MODEL_CONFIG.stt.estimatedSize);
        DOM.sttProgress.textContent = sttPercent + '%';
        DOM.sttProgressBar.style.width = sttPercent + '%';
        DOM.sttSize.textContent = sttDownloadedMB + ' MB / ' + MODEL_CONFIG.stt.estimatedSize + ' MB';
        
        if (progress >= 1) llmComplete = true;
      }
      
      if (llmComplete) {
        resolve();
      }
    });
    
    // Start download
    ModelManager.downloadModel(MODEL_CONFIG.llm.id)
      .then(() => { llmComplete = true; resolve(); })
      .catch(reject);
  });
}

async function downloadModelsWithProgress() {
  return new Promise((resolve, reject) => {
    let llmComplete = false;
    let sttComplete = false;
    
    // Track download progress
    EventBus.shared.on('model.downloadProgress', (event) => {
      const { modelId, progress, bytesDownloaded, totalBytes } = event;
      
      if (modelId === MODEL_CONFIG.llm.id) {
        const percent = Math.round((progress || 0) * 100);
        const downloadedMB = Math.round((bytesDownloaded || 0) / 1024 / 1024);
        const totalMB = Math.round((totalBytes || 0) / 1024 / 1024);
        
        DOM.llmProgress.textContent = percent + '%';
        DOM.llmProgressBar.style.width = percent + '%';
        DOM.llmSize.textContent = downloadedMB + ' MB / ' + totalMB + ' MB';
        
        if (progress >= 1) llmComplete = true;
      }
      
      if (modelId === MODEL_CONFIG.stt.id) {
        const percent = Math.round((progress || 0) * 100);
        const downloadedMB = Math.round((bytesDownloaded || 0) / 1024 / 1024);
        const totalMB = Math.round((totalBytes || 0) / 1024 / 1024);
        
        DOM.sttProgress.textContent = percent + '%';
        DOM.sttProgressBar.style.width = percent + '%';
        DOM.sttSize.textContent = downloadedMB + ' MB / ' + totalMB + ' MB';
        
        if (progress >= 1) sttComplete = true;
      }
      
      if (llmComplete && sttComplete) {
        resolve();
      }
    });
    
    // Start downloads
    ModelManager.downloadModel(MODEL_CONFIG.llm.id)
      .then(() => { llmComplete = true; if (sttComplete) resolve(); })
      .catch(reject);
    
    ModelManager.downloadModel(MODEL_CONFIG.stt.id)
      .then(() => { sttComplete = true; if (llmComplete) resolve(); })
      .catch(reject);
  });
}

function setupEventListeners() {
  DOM.recordButton.addEventListener('click', handleRecordButtonClick);
  DOM.newRecordingButton.addEventListener('click', resetForNewRecording);
  DOM.saveResultsButton.addEventListener('click', saveResults);
  DOM.copyTranscriptBtn.addEventListener('click', () => copyToClipboard(AppState.transcriptText, 'Transcript'));
  DOM.copySummaryBtn.addEventListener('click', copySummary);
  DOM.modalClose.addEventListener('click', hideModal);
  DOM.modalOkButton.addEventListener('click', hideModal);
  DOM.errorModal.addEventListener('click', (e) => { if (e.target === DOM.errorModal) hideModal(); });
}

async function handleRecordButtonClick() {
  if (AppState.isRecording) await stopRecording();
  else await startRecording();
}

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { sampleRate: AUDIO_SAMPLE_RATE, channelCount: 1, echoCancellation: true, noiseSuppression: true }
    });
    AppState.mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
    AppState.audioChunks = [];
    AppState.mediaRecorder.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0) AppState.audioChunks.push(event.data);
    });
    AppState.mediaRecorder.addEventListener('stop', onRecordingStop);
    AppState.mediaRecorder.start();
    AppState.isRecording = true;
    AppState.recordingStartTime = Date.now();
    updateStatus('Recording...', 'recording');
    DOM.recordButton.classList.add('recording');
    DOM.recordIcon.textContent = '⏹️';
    DOM.recordText.textContent = 'Stop Recording';
    DOM.durationContainer.classList.remove('hidden');
    startDurationTimer();
  } catch (error) {
    console.error('Recording error:', error);
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      showError('Microphone Access Denied', 'Please grant microphone permission.');
    } else {
      showError('Recording Failed', error.message);
    }
  }
}

async function stopRecording() {
  if (!AppState.mediaRecorder || !AppState.isRecording) return;
  AppState.mediaRecorder.stop();
  AppState.mediaRecorder.stream.getTracks().forEach(track => track.stop());
  stopDurationTimer();
  AppState.isRecording = false;
  DOM.recordButton.classList.remove('recording');
  DOM.recordButton.disabled = true;
}

async function onRecordingStop() {
  try {
    AppState.audioBlob = new Blob(AppState.audioChunks, { type: 'audio/webm' });
    await processAudio();
  } catch (error) {
    console.error('Processing error:', error);
    showError('Processing Failed', error.message);
    updateStatus('Processing Failed', 'error');
    DOM.recordButton.disabled = false;
  }
}

function startDurationTimer() {
  AppState.recordingTimer = setInterval(() => {
    const elapsed = Date.now() - AppState.recordingStartTime;
    const percentage = (elapsed / MAX_RECORDING_DURATION_MS) * 100;
    DOM.currentDuration.textContent = formatDuration(elapsed);
    DOM.durationBar.style.width = percentage + '%';
    if (elapsed >= MAX_RECORDING_DURATION_MS) {
      stopRecording();
      showToast('Maximum duration reached', 'warning');
    }
  }, 1000);
}

function stopDurationTimer() {
  if (AppState.recordingTimer) {
    clearInterval(AppState.recordingTimer);
    AppState.recordingTimer = null;
  }
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
}

async function processAudio() {
  try {
    updateStatus('Converting audio...', 'processing');
    AppState.isProcessing = true;
    
    const audioData = await convertBlobToFloat32Array(AppState.audioBlob);
    
    updateStatus('Transcribing...', 'processing');
    const result = await STT.transcribe(audioData);
    AppState.transcriptText = result.text;
    
    displayTranscript(result.text);
    
    await generateSummary(result.text);
    
    updateStatus('Complete', 'ready');
    AppState.isProcessing = false;
    DOM.actionButtons.classList.remove('hidden');
    
  } catch (error) {
    console.error('Processing error:', error);
    showError('Processing Failed', error.message);
    updateStatus('Failed', 'error');
    DOM.recordButton.disabled = false;
  }
}

async function convertBlobToFloat32Array(blob) {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: AUDIO_SAMPLE_RATE });
  const arrayBuffer = await blob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  let audioData;
  if (audioBuffer.numberOfChannels > 1) {
    const channel1 = audioBuffer.getChannelData(0);
    const channel2 = audioBuffer.getChannelData(1);
    audioData = new Float32Array(channel1.length);
    for (let i = 0; i < channel1.length; i++) {
      audioData[i] = (channel1[i] + channel2[i]) / 2;
    }
  } else {
    audioData = audioBuffer.getChannelData(0);
  }
  if (audioBuffer.sampleRate !== AUDIO_SAMPLE_RATE) {
    audioData = resampleAudio(audioData, audioBuffer.sampleRate, AUDIO_SAMPLE_RATE);
  }
  return audioData;
}

function resampleAudio(audioData, fromSampleRate, toSampleRate) {
  const ratio = fromSampleRate / toSampleRate;
  const newLength = Math.round(audioData.length / ratio);
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const srcIndex = i * ratio;
    const srcIndexFloor = Math.floor(srcIndex);
    const srcIndexCeil = Math.min(srcIndexFloor + 1, audioData.length - 1);
    const t = srcIndex - srcIndexFloor;
    result[i] = audioData[srcIndexFloor] * (1 - t) + audioData[srcIndexCeil] * t;
  }
  return result;
}

function displayTranscript(text) {
  const t = text && text.length ? text : '(Transcript not available)';
  DOM.transcriptContent.textContent = t;
  DOM.transcriptPlaceholder.classList.add('hidden');
  DOM.transcriptContent.classList.remove('hidden');
  DOM.copyTranscriptBtn.classList.remove('hidden');
}

async function generateSummary(transcript) {
  try {
    updateStatus('Generating summary...', 'processing');
    
    const prompt = 'You are an AI meeting assistant. Analyze this meeting transcript and provide:\n\n1. A concise summary (2-3 sentences)\n2. Action items in bullet format with responsible parties\n\nMeeting Transcript:\n' + transcript + '\n\nPlease format your response exactly as follows:\n\nSUMMARY:\n[Your summary here]\n\nACTION ITEMS:\n• [Action item 1] (Responsible: [Person/Team])\n• [Action item 2] (Responsible: [Person/Team])';
    
    const { stream, result: resultPromise } = await TextGeneration.generateStream(prompt, {
      maxTokens: 500,
      temperature: 0.7
    });
    
    let fullResponse = '';
    for await (const token of stream) {
      fullResponse += token;
    }
    
    const result = await resultPromise;
    parseSummaryResponse(result.text);
    
  } catch (error) {
    console.error('Summary error:', error);
    showError('Summary Generation Failed', error.message);
  }
}

function parseSummaryResponse(text) {
  const summaryMatch = text.match(/SUMMARY:\s*([\s\S]*?)\s*ACTION ITEMS:/i);
  const actionMatch = text.match(/ACTION ITEMS:\s*([\s\S]*?)$/i);
  
  const summary = summaryMatch ? summaryMatch[1].trim() : text.split('\n')[0];
  const actionItemsText = actionMatch ? actionMatch[1].trim() : '';
  
  const actionItems = actionItemsText
    .split('\n')
    .filter(line => line.trim().startsWith('•') || line.trim().startsWith('-') || line.trim().match(/^\d+\./))
    .map(line => line.trim().replace(/^[•\-]\s*/, '').replace(/^\d+\.\s*/, ''));
  
  displaySummary(summary, actionItems);
}

function displaySummary(summary, actionItems) {
  DOM.summaryPlaceholder.classList.add('hidden');
  DOM.summaryContent.classList.remove('hidden');
  DOM.summaryText.textContent = summary;
  
  DOM.actionItemsList.innerHTML = '';
  if (actionItems.length > 0) {
    actionItems.forEach(item => {
      const li = document.createElement('li');
      li.textContent = item;
      DOM.actionItemsList.appendChild(li);
    });
  } else {
    const li = document.createElement('li');
    li.textContent = 'No action items identified';
    DOM.actionItemsList.appendChild(li);
  }
  
  DOM.copySummaryBtn.classList.remove('hidden');
}

function resetForNewRecording() {
  AppState.audioChunks = [];
  AppState.audioBlob = null;
  AppState.transcriptText = '';
  
  DOM.transcriptContent.classList.add('hidden');
  DOM.transcriptPlaceholder.classList.remove('hidden');
  DOM.copyTranscriptBtn.classList.add('hidden');
  
  DOM.summaryContent.classList.add('hidden');
  DOM.summaryPlaceholder.classList.remove('hidden');
  DOM.copySummaryBtn.classList.add('hidden');
  
  DOM.actionButtons.classList.add('hidden');
  DOM.durationContainer.classList.add('hidden');
  DOM.currentDuration.textContent = '00:00:00';
  DOM.durationBar.style.width = '0%';
  
  DOM.recordButton.disabled = false;
  updateStatus('Ready to Record', 'ready');
}

function saveResults() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = 'meeting-' + timestamp + '.txt';
  
  let content = 'MEETING TRANSCRIPT\n';
  content += 'Date: ' + new Date().toLocaleString() + '\n\n';
  content += '='.repeat(50) + '\n\n';
  content += 'TRANSCRIPT:\n' + AppState.transcriptText + '\n\n';
  content += '='.repeat(50) + '\n\n';
  content += 'SUMMARY:\n' + DOM.summaryText.textContent + '\n\n';
  content += 'ACTION ITEMS:\n';
  
  Array.from(DOM.actionItemsList.children).forEach((li, index) => {
    content += (index + 1) + '. ' + li.textContent + '\n';
  });
  
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  showToast('Results saved!', 'success');
}

async function copyToClipboard(text, label) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(label + ' copied!', 'success');
  } catch (error) {
    showToast('Copy failed', 'error');
  }
}

async function copySummary() {
  const summary = DOM.summaryText.textContent;
  const actionItems = Array.from(DOM.actionItemsList.children)
    .map((li, index) => (index + 1) + '. ' + li.textContent)
    .join('\n');
  const fullText = 'SUMMARY:\n' + summary + '\n\nACTION ITEMS:\n' + actionItems;
  await copyToClipboard(fullText, 'Summary');
}

function updateStatus(text, state) {
  DOM.statusText.textContent = text;
  DOM.statusIndicator.className = 'status-indicator';
  if (state) DOM.statusIndicator.classList.add(state);
}

function updateModelsStatus(text, showSpinner) {
  DOM.modelsText.textContent = text;
  const spinner = DOM.modelsStatus.querySelector('.loading-spinner');
  if (spinner) {
    spinner.style.display = showSpinner ? 'inline-block' : 'none';
  }
}

function showError(title, message) {
  DOM.errorMessage.textContent = message;
  DOM.errorModal.classList.remove('hidden');
}

function hideModal() {
  DOM.errorModal.classList.add('hidden');
}

function showToast(message, type) {
  type = type || 'success';
  DOM.toastMessage.textContent = message;
  DOM.toast.className = 'toast';
  DOM.toast.classList.add(type);
  DOM.toast.classList.remove('hidden');
  setTimeout(function() { DOM.toast.classList.add('hidden'); }, 3000);
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
