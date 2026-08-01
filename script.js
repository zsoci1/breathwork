const PHASE_DURATION_SECONDS = 4;
const PHASES = ["Breathe in", "Hold", "Breathe out", "Hold"];

const durationInput = document.getElementById("durationMinutes");
const startButton = document.getElementById("startButton");
const pauseButton = document.getElementById("pauseButton");
const resetButton = document.getElementById("resetButton");
const phaseLabel = document.getElementById("phaseLabel");
const phaseCountdown = document.getElementById("phaseCountdown");
const sessionCountdown = document.getElementById("sessionCountdown");
const dot = document.getElementById("dot");

let totalSessionMs = 5 * 60 * 1000;
let elapsedMs = 0;
let running = false;
let animationFrameId = null;
let previousTimestamp = null;

function formatTime(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const minutesPart = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secondsPart = String(seconds % 60).padStart(2, "0");
  return `${minutesPart}:${secondsPart}`;
}

function phaseData(currentElapsedMs) {
  const phaseMs = PHASE_DURATION_SECONDS * 1000;
  const cycleMs = phaseMs * PHASES.length;
  const cycleProgressMs = currentElapsedMs % cycleMs;
  const phaseIndex = Math.floor(cycleProgressMs / phaseMs);
  const phaseProgress = (cycleProgressMs % phaseMs) / phaseMs;
  return { phaseIndex, phaseProgress };
}

function dotPosition(progress, phaseIndex) {
  switch (phaseIndex) {
    case 0:
      return { x: progress, y: 0 };
    case 1:
      return { x: 1, y: progress };
    case 2:
      return { x: 1 - progress, y: 1 };
    default:
      return { x: 0, y: 1 - progress };
  }
}

function render() {
  const remainingMs = Math.max(0, totalSessionMs - elapsedMs);
  sessionCountdown.textContent = `Session: ${formatTime(remainingMs)}`;

  if (!running && elapsedMs === 0) {
    phaseLabel.textContent = "Ready";
    phaseCountdown.textContent = "Phase: --";
    dot.style.left = "0%";
    dot.style.top = "0%";
    return;
  }

  const { phaseIndex, phaseProgress } = phaseData(elapsedMs);
  const position = dotPosition(phaseProgress, phaseIndex);
  dot.style.left = `${position.x * 100}%`;
  dot.style.top = `${position.y * 100}%`;
  phaseLabel.textContent = PHASES[phaseIndex];

  const phaseRemaining = Math.ceil(PHASE_DURATION_SECONDS - phaseProgress * PHASE_DURATION_SECONDS);
  phaseCountdown.textContent = `Phase: ${Math.max(1, phaseRemaining)}s`;
}

function stopSession() {
  running = false;
  previousTimestamp = null;
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  pauseButton.textContent = "Pause";
  pauseButton.disabled = true;
  resetButton.disabled = false;
  durationInput.disabled = false;
}

function animate(timestamp) {
  if (!running) {
    return;
  }

  if (previousTimestamp === null) {
    previousTimestamp = timestamp;
  }

  const delta = timestamp - previousTimestamp;
  previousTimestamp = timestamp;
  elapsedMs += delta;

  if (elapsedMs >= totalSessionMs) {
    elapsedMs = totalSessionMs;
    render();
    phaseLabel.textContent = "Session complete";
    phaseCountdown.textContent = "Phase: done";
    stopSession();
    return;
  }

  render();
  animationFrameId = requestAnimationFrame(animate);
}

function startOrResume() {
  if (running) {
    return;
  }

  if (elapsedMs === 0) {
    const minutes = Number(durationInput.value);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      durationInput.value = "5";
      totalSessionMs = 5 * 60 * 1000;
    } else {
      totalSessionMs = minutes * 60 * 1000;
    }
  }

  running = true;
  durationInput.disabled = true;
  pauseButton.disabled = false;
  resetButton.disabled = false;
  pauseButton.textContent = "Pause";
  previousTimestamp = null;
  animationFrameId = requestAnimationFrame(animate);
}

function pauseOrResume() {
  if (!running) {
    startOrResume();
    pauseButton.textContent = "Pause";
    return;
  }

  running = false;
  pauseButton.textContent = "Resume";
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

function resetSession() {
  elapsedMs = 0;
  stopSession();
  resetButton.disabled = true;
  render();
}

startButton.addEventListener("click", startOrResume);
pauseButton.addEventListener("click", pauseOrResume);
resetButton.addEventListener("click", resetSession);

render();
