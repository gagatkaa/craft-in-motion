let video,
  poseNet,
  poses = [],
  canvas,
  cameraSelect;
let measuredHand = "right";

// Tempo detection
const WRIST_HISTORY_LENGTH = 30;
const MIN_MOVEMENT_THRESHOLD = 5;
const JITTER_MOVEMENT_THRESHOLD = 12;
const BEAT_INTERVAL_HISTORY = 10;
const STATIC_RESET_THRESHOLD_MS = 3000;

let wristYHistory = [];
let lastBeatTime = 0;
let beatTimestamps = [];
let lastFrameTime = 0;

// Elbow angle
const ELBOW_OK_MIN = 10;
const ELBOW_OK_MAX = 75;
const ANGLE_SMOOTHING = 5;
let elbowAngleHistory = [];

// Video & light
const VIDEO_WIDTH = 640;
const VIDEO_HEIGHT = 480;
let lastLuminance = 0;
const LOW_LIGHT_THRESHOLD = 50;

// Blink (tempo feedback)
let blinkFrames = 0;
let lastBlinkPart = null;

// Safety banner hold
let unsafeUntil = 0;
const UNSAFE_HOLD_MS = 600;

// --- SIMPLE FACE HIT-TEST ---
function checkHandsShakerInFrontOfFace(pose, opts = {}) {
  if (!pose) return { isUnsafe: false, reason: "no-pose" };

  const minConf = opts.minConf ?? 0.35;
  const padK = opts.padK ?? 0.8; // margin around face rect (in eye-dist units)
  const tipK = opts.tipK ?? 0.7; // how far beyond wrist (fraction of forearm)

  const L = pose.leftEye,
    R = pose.rightEye,
    N = pose.nose;
  const good = (k) => k && (k.confidence ?? k.score ?? 0) >= minConf;

  if (!good(L) || !good(R)) return { isUnsafe: false, reason: "no-face" };

  const eyeDist = Math.hypot(L.x - R.x, L.y - R.y);

  // center between eyes, nudged toward nose if present
  const cx = N && good(N) ? (L.x + R.x) * 0.33 + N.x * 0.34 : (L.x + R.x) / 2;
  const cy = N && good(N) ? (L.y + R.y) * 0.33 + N.y * 0.34 : (L.y + R.y) / 2;

  const w = (2.2 + padK) * eyeDist;
  const h = (2.6 + padK) * eyeDist;
  const faceRect = {
    x1: cx - w / 2,
    y1: cy - h * 0.45,
    x2: cx + w / 2,
    y2: cy + h * 0.55,
  };

  const pointInRect = (p) =>
    p &&
    (p.confidence ?? p.score ?? 0) >= minConf &&
    p.x >= faceRect.x1 &&
    p.x <= faceRect.x2 &&
    p.y >= faceRect.y1 &&
    p.y <= faceRect.y2;

  const rw = pose.rightWrist,
    lw = pose.leftWrist;
  const re = pose.rightElbow,
    le = pose.leftElbow;

  const offenders = [];

  if (pointInRect(rw)) offenders.push("rightWrist");
  if (pointInRect(lw)) offenders.push("leftWrist");

  const handTip = (wrist, elbow, tag) => {
    if (!wrist || !elbow || !good(wrist) || !good(elbow)) return;
    const vx = wrist.x - elbow.x,
      vy = wrist.y - elbow.y;
    const len = Math.hypot(vx, vy) || 1e-6;
    const tip = {
      x: wrist.x + (vx / len) * (tipK * len),
      y: wrist.y + (vy / len) * (tipK * len),
      confidence: 1,
    };
    if (pointInRect(tip)) offenders.push(tag);
    return tip;
  };
  const tipR = handTip(rw, re, "rightHandTip");
  const tipL = handTip(lw, le, "leftHandTip");

  const isUnsafe = offenders.length > 0;
  return { isUnsafe, faceRect, offenders, tips: { tipR, tipL } };
}

const sketch = (p) => {
  p.setup = () => {
    canvas = p.createCanvas(VIDEO_WIDTH, VIDEO_HEIGHT);
    canvas.parent("p5-canvas-container");
    canvas.elt.id = "p5-canvas";

    cameraSelect = document.getElementById("camera-select");
    wireHandSelection();
    p.getMediaDevices();

    lastFrameTime = p.millis();
  };

  function wireHandSelection() {
    document.querySelectorAll('input[name="hand"]').forEach((r) => {
      r.addEventListener("change", (e) => {
        measuredHand = e.target.value;
        wristYHistory = [];
        beatTimestamps = [];
        lastBeatTime = 0;
        elbowAngleHistory = [];
        document.getElementById("tempo-display").textContent = "0.0";
        document.getElementById("elbow-angle").textContent = "—";
        document.getElementById("form-status").textContent = "—";
      });
    });
  }

  p.getMediaDevices = () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      document.getElementById("status-text").textContent =
        "Camera selection unavailable.";
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: false })
      .then((stream) => {
        stream.getTracks().forEach((t) => t.stop());
        return navigator.mediaDevices.enumerateDevices();
      })
      .then((devices) => {
        const videoDevices = devices.filter((d) => d.kind === "videoinput");
        if (!videoDevices.length) {
          document.getElementById("status-text").textContent =
            "No camera found.";
          return;
        }
        cameraSelect.innerHTML = "";
        videoDevices.forEach((device, idx) => {
          const opt = document.createElement("option");
          opt.value = device.deviceId;
          opt.text = device.label || `Camera ${idx + 1}`;
          cameraSelect.appendChild(opt);
        });
        p.startVideo(videoDevices[0].deviceId);
        cameraSelect.onchange = (e) => p.startVideo(e.target.value);
      })
      .catch((err) => {
        console.error("Camera access error:", err);
        document.getElementById("status-text").textContent =
          "Camera Blocked/Error: " + err.name;
      });
  };

  p.startVideo = (deviceId) => {
    if (video?.elt?.srcObject) {
      video.elt.srcObject.getTracks().forEach((t) => t.stop());
      video.remove();
    }
    const constraints = {
      video: {
        deviceId: { exact: deviceId },
        width: VIDEO_WIDTH,
        height: VIDEO_HEIGHT,
      },
      audio: false,
    };
    video = p.createCapture(constraints, p.videoLoaded);
    video.size(VIDEO_WIDTH, VIDEO_HEIGHT);
    video.hide();
    const st = document.getElementById("status-text");
    st.textContent = "Loading Model...";
    st.style.color = "#d97706";
  };

  p.videoLoaded = () => {
    if (poseNet) {
      poseNet.video = video.elt;
      poseNet.removeAllListeners("pose");
    }
    poseNet = ml5.poseNet(
      video,
      { flipHorizontal: true, detectionType: "single" },
      p.modelReady
    );
    poseNet.on("pose", p.gotPoses);
  };

  p.modelReady = () => {
    const st = document.getElementById("status-text");
    st.textContent = "Ready!";
    st.style.color = "#10b981";
  };

  p.gotPoses = (results) => {
    poses = results;
  };

  p.draw = () => {
    const now = p.millis();
    lastFrameTime = now;

    if (video && video.elt.readyState === 4) {
      p.push();
      p.translate(VIDEO_WIDTH, 0);
      p.scale(-1, 1);
      p.image(video, 0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
      p.pop();

      p.analyzeLuminance();
      p.drawPoseData();
    } else {
      p.background(50);
      p.fill(255);
      p.textSize(24);
      p.textAlign(p.CENTER, p.CENTER);
      p.text("Awaiting Camera/Model...", VIDEO_WIDTH / 2, VIDEO_HEIGHT / 2);
    }

    p.fill(255, 255, 255, 180);
    p.noStroke();
    p.rect(0, VIDEO_HEIGHT - 30, 260, 30, 0, 8, 0, 0);
    p.fill(0);
    p.textSize(12);
    p.textAlign(p.LEFT, p.CENTER);
    p.text(
      `Light: ${p.nf(lastLuminance, 0, 1)} | FPS: ${p.nf(p.frameRate(), 0, 1)}`,
      10,
      VIDEO_HEIGHT - 15
    );
  };

  p.analyzeLuminance = () => {
    let sum = 0,
      step = 20,
      count = (VIDEO_WIDTH / step) * (VIDEO_HEIGHT / step);
    if (video.elt.readyState === 4) {
      video.loadPixels();
      for (let x = 0; x < VIDEO_WIDTH; x += step) {
        for (let y = 0; y < VIDEO_HEIGHT; y += step) {
          const idx = (x + y * VIDEO_WIDTH) * 4;
          const r = video.pixels[idx],
            g = video.pixels[idx + 1],
            b = video.pixels[idx + 2];
          sum += 0.299 * r + 0.587 * g + 0.114 * b;
        }
      }
      lastLuminance = sum / count;
    } else lastLuminance = 255;
    document.getElementById("low-light-warning").style.display =
      lastLuminance < LOW_LIGHT_THRESHOLD ? "block" : "none";
  };

  p.drawPoseData = () => {
    const now = p.millis();
    const safetyBanner = document.getElementById("safety-warning");

    if (poses.length > 0) {
      const pose = poses[0].pose;
      p.drawKeypoints(pose);
      p.drawSkeleton(poses[0].skeleton);

      p.calculateTempo(pose, now);

      p.calculateElbowAngle(pose);

      const res = checkHandsShakerInFrontOfFace(pose, {
        minConf: 0.35,
        padK: 0.8,
        tipK: 0.75,
      });

      if (res.isUnsafe) unsafeUntil = now + UNSAFE_HOLD_MS;
      safetyBanner.style.display = now < unsafeUntil ? "block" : "none";

      if (res.faceRect) {
        p.push();
        p.noFill();
        p.stroke(now < unsafeUntil ? "#ef4444" : "#22c55e");
        p.strokeWeight(2);
        const r = res.faceRect;
        p.rect(r.x1, r.y1, r.x2 - r.x1, r.y2 - r.y1);
        p.pop();
      }
      if (res.tips?.tipR) {
        p.push();
        p.noStroke();
        p.fill("#f59e0b");
        p.circle(res.tips.tipR.x, res.tips.tipR.y, 8);
        p.pop();
      }
      if (res.tips?.tipL) {
        p.push();
        p.noStroke();
        p.fill("#f59e0b");
        p.circle(res.tips.tipL.x, res.tips.tipL.y, 8);
        p.pop();
      }
    } else {
      document.getElementById("tempo-display").textContent = "0.0";
      document.getElementById("elbow-angle").textContent = "—";
      document.getElementById("form-status").textContent = "—";
      safetyBanner.style.display = "none";
      lastBeatTime = now;
      beatTimestamps = [];
      elbowAngleHistory = [];
    }

    if (now - lastBeatTime > STATIC_RESET_THRESHOLD_MS) {
      document.getElementById("tempo-display").textContent = "0.0";
      beatTimestamps = [];
    }
  };

  p.calculateTempo = (pose, now) => {
    const wristName = measuredHand + "Wrist";
    const wrist = pose[wristName];
    const tempoDisplay = document.getElementById("tempo-display");
    if (!wrist || wrist.confidence < 0.5) {
      tempoDisplay.textContent = "...";
      return;
    }

    const y = wrist.y;
    wristYHistory.push(y);
    if (wristYHistory.length > WRIST_HISTORY_LENGTH) wristYHistory.shift();

    if (wristYHistory.length >= WRIST_HISTORY_LENGTH) {
      const minY = Math.min(...wristYHistory);
      const maxY = Math.max(...wristYHistory);
      if (maxY - minY < JITTER_MOVEMENT_THRESHOLD) {
        tempoDisplay.textContent = "0.0";
        lastBeatTime = now;
        beatTimestamps = [];
        return;
      }
    }

    if (wristYHistory.length > 10) {
      const fiveAgo = wristYHistory[wristYHistory.length - 5];
      const vel = y - fiveAgo;
      if (vel > MIN_MOVEMENT_THRESHOLD) {
        const tenAgo =
          wristYHistory[wristYHistory.length - 10] || wristYHistory[0];
        if (y > tenAgo) {
          lastBeatTime = now;
          beatTimestamps.push(now);
          if (beatTimestamps.length > BEAT_INTERVAL_HISTORY)
            beatTimestamps.shift();

          if (beatTimestamps.length >= 2) {
            const total = now - beatTimestamps[0];
            const n = beatTimestamps.length - 1;
            const avg = total / n;
            const bpm = 60000 / avg;
            tempoDisplay.textContent = p.nf(p.constrain(bpm, 0, 1500), 0, 1);
          }
          p.blinkKeypoint(wristName);
        }
      }
    }
  };

  p.calculateElbowAngle = (pose) => {
    const shoulder = pose[measuredHand + "Shoulder"];
    const elbow = pose[measuredHand + "Elbow"];
    const wrist = pose[measuredHand + "Wrist"];

    const angleEl = document.getElementById("elbow-angle");
    const formEl = document.getElementById("form-status");

    if (
      !shoulder ||
      !elbow ||
      !wrist ||
      shoulder.confidence < 0.4 ||
      elbow.confidence < 0.4 ||
      wrist.confidence < 0.4
    ) {
      angleEl.textContent = "—";
      formEl.textContent = "—";
      return;
    }

    let v1x = shoulder.x - elbow.x,
      v1y = shoulder.y - elbow.y; // upper arm
    let v2x = wrist.x - elbow.x,
      v2y = wrist.y - elbow.y; // forearm

    // normalize
    const m1 = Math.hypot(v1x, v1y),
      m2 = Math.hypot(v2x, v2y);
    if (m1 === 0 || m2 === 0) {
      angleEl.textContent = "—";
      formEl.textContent = "—";
      return;
    }
    v1x /= m1;
    v1y /= m1;
    v2x /= m2;
    v2y /= m2;

    let dot = v1x * v2x + v1y * v2y;
    dot = Math.max(-1, Math.min(1, dot));
    let angleDeg = Math.acos(dot) * (180 / Math.PI);

    elbowAngleHistory.push(angleDeg);
    if (elbowAngleHistory.length > ANGLE_SMOOTHING) elbowAngleHistory.shift();
    const avgAngle =
      elbowAngleHistory.reduce((a, b) => a + b, 0) / elbowAngleHistory.length;

    angleEl.textContent = Math.round(avgAngle);
    const ok = avgAngle >= ELBOW_OK_MIN && avgAngle <= ELBOW_OK_MAX;
    formEl.textContent = ok ? "OK" : "Adjust";

    p.drawElbowArc(elbow.x, elbow.y, v1x, v1y, v2x, v2y, ok);
  };

  p.drawElbowArc = (ex, ey, u_x, u_y, w_x, w_y, ok) => {
    const a1 = Math.atan2(u_y, u_x);
    const a2 = Math.atan2(w_y, w_x);

    let diff = a2 - a1;
    while (diff <= -Math.PI) diff += 2 * Math.PI;
    while (diff > Math.PI) diff -= 2 * Math.PI;

    const sweep = Math.abs(diff);

    let bx = u_x + w_x,
      by = u_y + w_y;
    let bm = Math.hypot(bx, by);
    if (bm < 1e-6) {
      const cross = u_x * w_y - u_y * w_x;
      bx = -u_y * Math.sign(cross || 1);
      by = u_x * Math.sign(cross || 1);
      bm = Math.hypot(bx, by);
    }
    bx /= bm;
    by /= bm;

    const mid = Math.atan2(by, bx);
    const start = mid - sweep / 2;
    const end = mid + sweep / 2;

    const r = 40;
    p.push();
    p.noFill();
    p.stroke(ok ? "#10b981" : "#ef4444");
    p.strokeWeight(5);
    p.arc(ex, ey, r * 2, r * 2, start, end);
    p.pop();
  };

  p.blinkKeypoint = (part) => {
    blinkFrames = 10;
    lastBlinkPart = part;
  };

  p.drawKeypoints = (pose) => {
    const tracked = [
      "nose",
      "leftEye",
      "rightEye",
      "leftEar",
      "rightEar",
      "leftShoulder",
      "rightShoulder",
      "leftElbow",
      "rightElbow",
      "leftWrist",
      "rightWrist",
    ];
    p.strokeWeight(0);
    for (let i = 0; i < pose.keypoints.length; i++) {
      const k = pose.keypoints[i];
      const part = k.part;
      if (k.score > 0.3 && tracked.includes(part)) {
        p.fill(49, 75, 237);
        let size = 12;
        const measuredPart = measuredHand + "Wrist";
        if (
          part === measuredPart &&
          part === lastBlinkPart &&
          blinkFrames > 0
        ) {
          p.fill(239, 68, 68);
          size = 25;
          blinkFrames--;
        } else if (blinkFrames <= 0) {
          lastBlinkPart = null;
        }
        p.ellipse(k.position.x, k.position.y, size, size);

        if (part === measuredPart) {
          p.fill(255);
          p.textSize(10);
          p.textAlign(p.CENTER, p.CENTER);
          p.text("BPM", k.position.x, k.position.y + 2);
        }
      }
    }
  };

  p.drawSkeleton = (skeleton) => {
    p.stroke(255);
    p.strokeWeight(3);
    for (let i = 0; i < skeleton.length; i++) {
      const a = skeleton[i][0],
        b = skeleton[i][1];
      if (a.score > 0.3 && b.score > 0.3) {
        p.line(a.position.x, a.position.y, b.position.x, b.position.y);
      }
    }
  };
};

window.onload = () => {
  new p5(sketch);
};
