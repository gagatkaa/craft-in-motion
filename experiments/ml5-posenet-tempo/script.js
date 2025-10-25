// Simple PoseNet tempo detector with elbow angle and wrist vertical speed
const video = document.getElementById("video");
const overlay = document.getElementById("overlay");
const ctx = overlay.getContext("2d");

const fpsEl = document.getElementById("fps");
const angleEl = document.getElementById("angle");
const tempoEl = document.getElementById("tempo");
const consistencyEl = document.getElementById("consistency");
const pointEl = document.getElementById("point");

const inputSizeSel = document.getElementById("inputSize");
const smoothingRange = document.getElementById("smoothing");
const smoothingVal = document.getElementById("smoothingVal");
const peakRange = document.getElementById("peak");
const peakVal = document.getElementById("peakVal");

let poseNet;
let lastTime = performance.now();
let ema = (prev, next, a) => a * next + (1 - a) * prev;

let sm = { y: 0, vy: 0, angle: 0, inited: false };
let alpha = parseFloat(smoothingRange.value);

let peaks = []; // timestamps for detected peaks
let lastPeakT = 0;
let refractory = 90; // ms refractory to avoid double peaks
let peakThresh = parseFloat(peakRange.value); // in px per frame

let useWidth = parseInt(inputSizeSel.value, 10);

smoothingRange.addEventListener("input", () => {
  alpha = parseFloat(smoothingRange.value);
  smoothingVal.textContent = alpha.toFixed(2);
});

peakRange.addEventListener("input", () => {
  peakThresh = parseFloat(peakRange.value);
  peakVal.textContent = peakThresh.toString();
});

inputSizeSel.addEventListener("change", async () => {
  useWidth = parseInt(inputSizeSel.value, 10);
  await stopCamera();
  await startCamera();
});

async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: useWidth }, facingMode: "user" },
    audio: false,
  });
  video.srcObject = stream;
  await new Promise((res) => (video.onloadedmetadata = res));
  video.play();

  overlay.width = video.videoWidth;
  overlay.height = video.videoHeight;

  poseNet = ml5.poseNet(video, { detectionType: "single" }, () => {
    console.log("PoseNet ready");
    requestAnimationFrame(loop);
  });
}

async function stopCamera() {
  if (video.srcObject) {
    video.srcObject.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
  }
}

function kpt(map, name) {
  return map[name]
    ? { x: map[name].x, y: map[name].y, c: map[name].confidence ?? 1 }
    : null;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function angleAt(b, a, c) {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const mag = Math.hypot(ab.x, ab.y) * Math.hypot(cb.x, cb.y);
  if (mag === 0) return 0;
  let cos = dot / mag;
  cos = Math.max(-1, Math.min(1, cos));
  return (Math.acos(cos) * 180) / Math.PI;
}

function drawSkeleton(keypoints) {
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 2;
  const parts = [
    "leftShoulder",
    "rightShoulder",
    "leftElbow",
    "rightElbow",
    "leftWrist",
    "rightWrist",
    "leftHip",
    "rightHip",
  ];
  const kp = {};
  keypoints.forEach((k) => {
    kp[k.part] = { x: k.position.x, y: k.position.y, confidence: k.score };
  });

  function line(a, b) {
    if (!a || !b) return;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  line(kp.leftShoulder, kp.rightShoulder);
  line(kp.leftShoulder, kp.leftElbow);
  line(kp.leftElbow, kp.leftWrist);
  line(kp.rightShoulder, kp.rightElbow);
  line(kp.rightElbow, kp.rightWrist);
  line(kp.leftHip, kp.rightHip);
}

function updateHUD(angleDeg, tempoHz, sd, usingPoint) {
  angleEl.textContent = Number.isFinite(angleDeg) ? angleDeg.toFixed(0) : "0";
  tempoEl.textContent = Number.isFinite(tempoHz) ? tempoHz.toFixed(2) : "0.00";
  consistencyEl.textContent = Number.isFinite(sd) ? sd.toFixed(2) : "0.00";
  pointEl.textContent = usingPoint;
}

function estimateTempo(now, val) {
  // simple peak detection using sign change of velocity
  const vy = sm.inited ? val - sm.y : 0;
  const vySm = sm.inited ? ema(sm.vy, vy, alpha) : 0;
  const crossed = Math.sign(sm.vy) > 0 && Math.sign(vySm) <= 0; // local maxima
  let detected = false;

  if (sm.inited) {
    if (crossed && Math.abs(vySm) < peakThresh) {
      // too small to be a real peak
    } else if (crossed) {
      if (now - lastPeakT > refractory) {
        peaks.push(now);
        if (peaks.length > 60) peaks.shift();
        lastPeakT = now;
        detected = true;
      }
    }
  }
  sm.y = sm.inited ? ema(sm.y, val, alpha) : val;
  sm.vy = vySm;
  sm.inited = true;

  // compute Hz and stability
  let hz = 0;
  let sd = 0;
  if (peaks.length >= 3) {
    const intervals = [];
    for (let i = 1; i < peaks.length; i++)
      intervals.push((peaks[i] - peaks[i - 1]) / 1000);
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    hz = mean > 0 ? 1 / mean : 0;
    const varr =
      intervals.reduce((a, b) => a + (b - mean) * (b - mean), 0) /
      intervals.length;
    sd = Math.sqrt(varr);
  }
  return { hz, sd, detected };
}

async function loop() {
  const now = performance.now();
  const dt = now - lastTime;
  lastTime = now;

  // clear
  ctx.clearRect(0, 0, overlay.width, overlay.height);

  // draw video frame behind canvas by CSS, we only draw overlay
  // get last pose from internal model
  const poses = await poseNet.singlePose(video);

  if (poses && poses.pose && poses.pose.keypoints) {
    const kps = poses.pose.keypoints;
    drawSkeleton(kps);

    const map = {};
    kps.forEach(
      (k) => (map[k.part] = { x: k.position.x, y: k.position.y, c: k.score })
    );

    const ls = kpt(map, "leftShoulder");
    const le = kpt(map, "leftElbow");
    const lw = kpt(map, "leftWrist");
    const rs = kpt(map, "rightShoulder");
    const re = kpt(map, "rightElbow");
    const rw = kpt(map, "rightWrist");

    // elbow angle on right arm if available, else left
    let angleDeg = null;
    if (re && rs && rw) {
      angleDeg = angleAt(re, rs, rw);
    } else if (le && ls && lw) {
      angleDeg = angleAt(le, ls, lw);
    }

    // choose tracking point for vertical signal: prefer right wrist, fallback to right elbow, then left counterparts
    let track = null;
    let using = "wrist";
    if (rw && rw.c > 0.3) track = rw;
    else if (re && re.c > 0.3) {
      track = re;
      using = "elbow";
    } else if (lw && lw.c > 0.3) track = lw;
    else if (le && le.c > 0.3) {
      track = le;
      using = "elbow";
    }

    let hz = 0;
    let sd = 0;

    if (track) {
      const { hz: thz, sd: tsd } = estimateTempo(now, track.y);
      hz = thz;
      sd = tsd;

      // simple visual peak marker if wanted: draw small circles when vy crosses
      // omitted for clarity
    }

    updateHUD(angleDeg ?? 0, hz, sd, using);

    // simple FPS
    const fps = 1000 / dt;
    fpsEl.textContent = fps.toFixed(0);

    // overlay helpful bands
    // angle target band 70 to 100
    if (angleDeg != null) {
      ctx.fillStyle = "rgba(255, 200, 0, 0.12)";
      ctx.fillRect(
        10,
        10,
        Math.max(
          0,
          Math.min(overlay.width - 20, (angleDeg / 180) * (overlay.width - 20))
        ),
        6
      );
      ctx.strokeStyle = "rgba(255, 200, 0, 0.8)";
      ctx.strokeRect(
        (70 / 180) * (overlay.width - 20) + 10,
        10,
        ((100 - 70) / 180) * (overlay.width - 20),
        6
      );
    }
  }

  requestAnimationFrame(loop);
}

// need https or localhost for webcam
startCamera().catch((err) => {
  alert(
    "Camera error. Check permissions or use a local server. " + err.message
  );
  console.error(err);
});
