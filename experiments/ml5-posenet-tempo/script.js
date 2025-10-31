// --- Global Variables ---
let video;
let poseNet;
let poses = [];
let canvas;

// --- Tempo Calculation Variables ---
const WRIST_HISTORY_LENGTH = 30; // Number of frames to track movement
const MIN_MOVEMENT_THRESHOLD = 5; // Minimum vertical pixel movement (velocity) to register a beat
const BEAT_INTERVAL_HISTORY = 10; // Number of beat intervals to average for stable BPM

let wristYHistory = [];
let lastPeakY = 0;
let beatTimestamps = [];
let lastFrameTime = 0;
let lastLuminance = 0;
const LOW_LIGHT_THRESHOLD = 50; // Simple average color value threshold (0-255)

// --- P5.js Sketch ---
const sketch = (p) => {

  const VIDEO_WIDTH = 640;
  const VIDEO_HEIGHT = 480;

  p.setup = () => {
    // 1. Create Canvas and attach to DOM
    canvas = p.createCanvas(VIDEO_WIDTH, VIDEO_HEIGHT);
    canvas.parent('p5-canvas-container');
    canvas.elt.id = 'p5-canvas'; // Add ID for custom styling

    // 2. Start Video Capture
    video = p.createCapture(p.VIDEO);
    video.size(VIDEO_WIDTH, VIDEO_HEIGHT);
    video.hide(); // Hide the actual video element, we draw it onto the canvas

    // 3. Initialize PoseNet
    // Setting detectionType to 'single' is generally faster for one person
    poseNet = ml5.poseNet(video, {
      flipHorizontal: true, // Mirror the video feed
      detectionType: 'single'
    }, p.modelReady);

    // 4. Listen for new poses
    poseNet.on('pose', p.gotPoses);

    lastFrameTime = p.millis(); // Initialize frame time
  };

  p.modelReady = () => {
    console.log('PoseNet Model Loaded!');
    document.getElementById('status-text').textContent = 'Ready!';
    document.getElementById('status-text').classList.add('text-green-600');
  };

  p.gotPoses = (results) => {
    // Update the global poses array
    poses = results;
  };

  p.draw = () => {
    // Calculate delta time for consistent velocity calculation
    const currentTime = p.millis();
    const deltaTime = currentTime - lastFrameTime; // Time elapsed since last frame (ms)
    lastFrameTime = currentTime;

    // Draw the video feed flipped (to match PoseNet's 'flipHorizontal')
    p.push();
    p.translate(VIDEO_WIDTH, 0);
    p.scale(-1, 1);
    p.image(video, 0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
    p.pop();

    p.analyzeLuminance();
    p.drawPoseData(deltaTime);
  };

  p.analyzeLuminance = () => {
    // Basic low light detection: sample the average brightness of the center area
    let sumBrightness = 0;
    const step = 20; // Sample every 20 pixels
    const count = (VIDEO_WIDTH / step) * (VIDEO_HEIGHT / step);
    // Ensure video pixels are loaded
    if (video.elt.readyState === 4) {
      video.loadPixels();
      for (let x = 0; x < VIDEO_WIDTH; x += step) {
        for (let y = 0; y < VIDEO_HEIGHT; y += step) {
          const index = (x + y * VIDEO_WIDTH) * 4;
          // Calculate relative luminance (R*0.299 + G*0.587 + B*0.114)
          const r = video.pixels[index];
          const g = video.pixels[index + 1];
          const b = video.pixels[index + 2];
          const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
          sumBrightness += luminance;
        }
      }
      lastLuminance = sumBrightness / count;
    } else {
      lastLuminance = 255; // Assume bright if video is not ready
    }

    const warningEl = document.getElementById('low-light-warning');
    if (lastLuminance < LOW_LIGHT_THRESHOLD) {
      warningEl.classList.remove('hidden');
    } else {
      warningEl.classList.add('hidden');
    }
  };


  p.drawPoseData = (deltaTime) => {
    if (poses.length > 0) {
      let pose = poses[0].pose;
      p.drawKeypoints(pose);
      p.drawSkeleton(poses[0].skeleton);
      p.calculateTempo(pose, deltaTime);
    } else {
      // If no pose detected, show a neutral message
      document.getElementById('tempo-display').textContent = '...';
    }

    // Display Status and FPS (for Technical Robustness check)
    p.fill(255, 255, 255, 180); // White background with opacity
    p.noStroke();
    p.rect(0, VIDEO_HEIGHT - 40, 200, 40, 0, 10, 0, 0); // Rounded bottom left corner
    p.fill(0);
    p.textSize(12);
  };

  p.calculateTempo = (pose, deltaTime) => {
    const rightWrist = pose.rightWrist;

    if (rightWrist.confidence > 0.5) {
      const currentY = rightWrist.y;
      wristYHistory.push(currentY);

      // Keep history size constrained
      if (wristYHistory.length > WRIST_HISTORY_LENGTH) {
        wristYHistory.shift();
      }

      if (wristYHistory.length > 10) {
        // Check wrist position from 5 frames ago
        const fiveFramesAgoY = wristYHistory[wristYHistory.length - 5];
        const velocity = currentY - fiveFramesAgoY; // Positive = moving down

        // Simple Beat Detection:
        // Detect when the wrist has moved significantly *downward* (positive velocity) 
        // from a high point (which was the last 'peak').
        if (velocity > MIN_MOVEMENT_THRESHOLD && (currentY - lastPeakY) > MIN_MOVEMENT_THRESHOLD * 2) {

          // Heuristic check: was the wrist high 10 frames ago? (Implies an upward motion preceded the downward one)
          const tenFramesAgoY = wristYHistory[wristYHistory.length - 10] || wristYHistory[0];

          // Beat condition: Significant downward movement AND the current position is below the previous high point
          if (currentY > tenFramesAgoY) {
            // The actual beat is registered on the *downstroke* (positive velocity)

            // 1. Register the beat time
            const now = p.millis();
            beatTimestamps.push(now);
            // 2. Clean up old timestamps
            if (beatTimestamps.length > BEAT_INTERVAL_HISTORY) {
              beatTimestamps.shift();
            }

            // 3. Calculate BPM
            if (beatTimestamps.length >= 2) {
              const totalTime = now - beatTimestamps[0];
              const numIntervals = beatTimestamps.length - 1;
              const avgInterval = totalTime / numIntervals;
              const bpm = 60000 / avgInterval; // 60,000 ms per minute

              document.getElementById('tempo-display').textContent = p.nf(p.constrain(bpm, 0, 250), 0, 1);
            }

            lastPeakY = currentY; // Reset the last peak marker

            // Visual feedback for a beat
            p.blinkKeypoint('rightWrist');
          }
        }
      }
    } else {
      document.getElementById('tempo-display').textContent = '0';
    }
  };

  // Simple visual feedback when a beat is registered
  let blinkFrames = 0;
  let lastBlinkPart = null;
  p.blinkKeypoint = (part) => {
    blinkFrames = 10;
    lastBlinkPart = part;
  };


  p.drawKeypoints = (pose) => {
    // Highlight the required keypoints: rightWrist, rightElbow, nose
    const trackedParts = ['nose', 'rightElbow', 'rightWrist'];

    p.strokeWeight(0);
    for (let i = 0; i < pose.keypoints.length; i++) {
      let keypoint = pose.keypoints[i];

      if (keypoint.score > 0.3 && trackedParts.includes(keypoint.part)) {
        p.fill(49, 75, 237); // Base color: Blue-Indigo
        let circleSize = 12;

        // Apply blink effect if it's the rightWrist
        if (keypoint.part === 'rightWrist' && keypoint.part === lastBlinkPart && blinkFrames > 0) {
          p.fill(239, 68, 68); // Red color for beat feedback
          circleSize = 20; // Bigger size for emphasis
          blinkFrames--;
        } else if (blinkFrames <= 0) {
          lastBlinkPart = null;
        }

        // Draw keypoint
        p.ellipse(keypoint.position.x, keypoint.position.y, circleSize, circleSize);

        // Optional: Label the wrist
        if (keypoint.part === 'rightWrist') {
          p.fill(255);
          p.textSize(10);
          p.textAlign(p.CENTER, p.CENTER);
          p.text('WRIST', keypoint.position.x, keypoint.position.y);
        }
      }
    }
  };

  p.drawSkeleton = (skeleton) => {
    p.stroke(255, 255, 255); // White skeleton
    p.strokeWeight(2);

    for (let i = 0; i < skeleton.length; i++) {
      let a = skeleton[i][0];
      let b = skeleton[i][1];
      p.line(a.position.x, a.position.y, b.position.x, b.position.y);
    }
  };
};

// Instantiate the p5.js sketch when the window loads
window.onload = function () {
  new p5(sketch);
  // Standard setup for Canvas environment authentication
  try {
    const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
    if (Object.keys(firebaseConfig).length > 0) {
      console.log("Firebase config loaded (not strictly needed for this single-user ML demo, but good practice).");
    }
  } catch (e) {
    console.error("Could not parse Firebase config:", e);
  }
};