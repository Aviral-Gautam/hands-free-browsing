// src/offscreen.js
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

let faceLandmarker;
let video;
let canvas;
let ctx;
let lastVideoTime = -1;
let statusEl;
let gestureEl;
let fpsEl;
let frameCount = 0;
let lastFpsTime = performance.now();

function updateStatus(text, type = 'info') {
  if (statusEl) {
    statusEl.textContent = text;
    statusEl.className = `status-badge ${type}`;
  }
}

async function init() {
  video = document.getElementById('webcam');
  canvas = document.getElementById('preview-canvas');
  if (canvas) {
    ctx = canvas.getContext('2d');
  }
  statusEl = document.getElementById('status');
  gestureEl = document.getElementById('gestures');
  fpsEl = document.getElementById('fps');

  updateStatus('Requesting camera access...', 'pending');

  // 1. Request Webcam Stream (with resilient audio acquisition fallback)
  try {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: true
      });
      console.log('Webcam & microphone stream acquired');
    } catch {
      // Fallback to video-only if microphone is not available or rejected
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false
      });
      console.log('Webcam-only stream acquired (audio unavailable or declined)');
    }
    video.srcObject = stream;
    await video.play();
    updateStatus('Camera connected. Loading model...', 'pending');
  } catch (err) {
    console.error('Camera permission denied or failed:', err);
    updateStatus('Camera permission denied. Please allow camera access in Firefox.', 'error');
    return;
  }

  // 2. Initialize MediaPipe FaceLandmarker with local assets and GPU->CPU fallback
  try {
    const wasmPath = chrome.runtime.getURL('wasm');
    const modelPath = chrome.runtime.getURL('models/face_landmarker.task');

    const vision = await FilesetResolver.forVisionTasks(wasmPath);

    try {
      faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: modelPath,
          delegate: 'GPU'
        },
        outputFaceBlendshapes: true,
        runningMode: 'VIDEO',
        numFaces: 1
      });
      console.log('MediaPipe FaceLandmarker initialized with GPU delegate');
    } catch (gpuError) {
      console.warn('GPU delegate failed, falling back to CPU delegate:', gpuError);
      faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: modelPath,
          delegate: 'CPU'
        },
        outputFaceBlendshapes: true,
        runningMode: 'VIDEO',
        numFaces: 1
      });
      console.log('MediaPipe FaceLandmarker initialized with CPU delegate');
    }

    updateStatus('Face tracking active', 'active');
    chrome.runtime.sendMessage({ type: 'TRACKER_STARTED' }).catch(() => {});
  } catch (initErr) {
    console.error('MediaPipe initialization failed:', initErr);
    updateStatus('Failed to load tracking model: ' + initErr.message, 'error');
    return;
  }

  // 3. Start Processing Loop
  predictWebcam();
}

async function predictWebcam() {
  const startTimeMs = performance.now();

  // FPS Calculation
  frameCount++;
  if (startTimeMs - lastFpsTime >= 1000) {
    if (fpsEl) fpsEl.textContent = `${frameCount} FPS`;
    frameCount = 0;
    lastFpsTime = startTimeMs;
  }

  if (video.readyState >= 2 && lastVideoTime !== video.currentTime && faceLandmarker) {
    lastVideoTime = video.currentTime;
    const results = faceLandmarker.detectForVideo(video, startTimeMs);

    // Draw preview mirror and tracking point if canvas is present
    if (ctx && canvas) {
      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(-1, 1);
      ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
      ctx.restore();
    }

    if (results.faceLandmarks.length > 0 && results.faceBlendshapes.length > 0) {
      // Nose Tip (Index 1) for cursor tracking
      const noseTip = results.faceLandmarks[0][1];

      // Blendshapes for gestures
      const blendshapes = results.faceBlendshapes[0].categories;
      const getScore = (name) => blendshapes.find((b) => b.categoryName === name)?.score || 0;

      const leftWink = getScore('eyeBlinkLeft');
      const rightWink = getScore('eyeBlinkRight');
      const jawOpen = getScore('jawOpen');
      const browInnerUp = getScore('browInnerUp');
      const mouthSmileLeft = getScore('mouthSmileLeft');
      const mouthSmileRight = getScore('mouthSmileRight');
      const mouthSmile = (mouthSmileLeft + mouthSmileRight) / 2;

      // Visual feedback on preview canvas
      if (ctx && canvas) {
        // Mirrored coordinate for drawing on mirrored canvas
        const drawX = (1 - noseTip.x) * canvas.width;
        const drawY = noseTip.y * canvas.height;

        ctx.fillStyle = '#a855f7';
        ctx.beginPath();
        ctx.arc(drawX, drawY, 8, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Update gesture indicators on companion UI
      if (gestureEl) {
        const gestures = [];
        const eyesClosed = leftWink > 0.6 && rightWink > 0.6;

        if (eyesClosed) {
          gestures.push('Eyes Closed (hold 1.5s = Disengage)');
        } else {
          if (leftWink > 0.55) gestures.push('Left Wink (Click)');
          if (rightWink > 0.55) gestures.push('Right Wink (Scroll Up)');
          if (jawOpen > 0.35) gestures.push('Jaw Open (Scroll Down)');
          if (browInnerUp > 0.55) gestures.push('Brow Raise (Scroll Up)');
          if (mouthSmile > 0.6) gestures.push('Smile (Mute)');
        }

        gestureEl.textContent = gestures.length > 0 ? gestures.join(' • ') : 'Tracking face...';
      }

      const payload = {
        type: 'FACE_DATA',
        data: {
          x: noseTip.x, // Normalized 0.0 to 1.0
          y: noseTip.y,
          leftWink,
          rightWink,
          jawOpen,
          browInnerUp,
          mouthSmile
        }
      };

      // Route face data through background service worker which relays to all active tabs.
      // Using only the background relay avoids double-delivery to content scripts.
      chrome.runtime.sendMessage(payload).catch(() => {});
    }
  }

  requestAnimationFrame(predictWebcam);
}

// Start once DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
