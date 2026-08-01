const DEFAULTS = {
  boxPhaseSeconds: 4,
};

const TECHNIQUES = {
  BOX: "box",
  ANCHOR: "anchor",
};

const ANCHOR_VIEWBOX_WIDTH = 560;
const ANCHOR_VIEWBOX_HEIGHT = 224;
const ANCHOR_ZIGZAG_MARGIN = 24;
const ANCHOR_INHALE_SECONDS = 4;
const ANCHOR_EXHALE_SECONDS = 6;
const ANCHOR_ASCENDING_WIDTH = 36;
const ANCHOR_DESCENDING_WIDTH = 108;
const ANCHOR_CYCLE_WIDTH = ANCHOR_ASCENDING_WIDTH + ANCHOR_DESCENDING_WIDTH;
const ANCHOR_EDGE_PADDING = ANCHOR_CYCLE_WIDTH;

const techniqueSelect = document.getElementById("technique");
const durationInput = document.getElementById("durationMinutes");
const boxPhaseControls = document.getElementById("boxPhaseControls");
const boxPhaseInput = document.getElementById("boxPhaseSeconds");
const startButton = document.getElementById("startButton");
const pauseButton = document.getElementById("pauseButton");
const resetButton = document.getElementById("resetButton");
const phaseLabel = document.getElementById("phaseLabel");
const phaseCountdown = document.getElementById("phaseCountdown");
const sessionCountdown = document.getElementById("sessionCountdown");
const boxGuide = document.getElementById("boxGuide");
const dot = document.getElementById("dot");
const anchorGuide = document.getElementById("anchorGuide");
const anchorPath = document.getElementById("anchorPath");
const anchorDot = document.getElementById("anchorDot");

let totalSessionMs = 5 * 60 * 1000;
let elapsedMs = 0;
let running = false;
let animationFrameId = null;
let previousTimestamp = null;
let technique = TECHNIQUES.BOX;
let boxPhaseSeconds = DEFAULTS.boxPhaseSeconds;

function formatTime(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const minutesPart = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secondsPart = String(seconds % 60).padStart(2, "0");
  return `${minutesPart}:${secondsPart}`;
}

function parsePositiveNumber(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function currentPhaseConfig() {
  if (technique === TECHNIQUES.BOX) {
    return {
      labels: ["Breathe in", "Hold", "Breathe out", "Hold"],
      durations: [boxPhaseSeconds, boxPhaseSeconds, boxPhaseSeconds, boxPhaseSeconds],
    };
  }

  return {
    labels: ["Breathe in", "Breathe out"],
    durations: [ANCHOR_INHALE_SECONDS, ANCHOR_EXHALE_SECONDS],
  };
}

function phaseData(currentElapsedMs) {
  const config = currentPhaseConfig();
  const cycleSeconds = config.durations.reduce((sum, duration) => sum + duration, 0);
  let cycleProgress = (currentElapsedMs / 1000) % cycleSeconds;

  for (let i = 0; i < config.durations.length; i += 1) {
    const duration = config.durations[i];
    if (cycleProgress < duration) {
      return {
        phaseIndex: i,
        phaseProgress: cycleProgress / duration,
        phaseDurationSeconds: duration,
        phaseLabel: config.labels[i],
      };
    }
    cycleProgress -= duration;
  }

  const last = config.durations.length - 1;
  return {
    phaseIndex: last,
    phaseProgress: 1,
    phaseDurationSeconds: config.durations[last],
    phaseLabel: config.labels[last],
  };
}

function boxDotPosition(progress, phaseIndex) {
  switch (phaseIndex) {
    case 0:
      return { x: 0, y: 1 - progress };
    case 1:
      return { x: progress, y: 0 };
    case 2:
      return { x: 1, y: progress };
    default:
      return { x: 1 - progress, y: 1 };
  }
}

function anchorBaseYAt(x, offset) {
  const top = ANCHOR_ZIGZAG_MARGIN;
  const bottom = ANCHOR_VIEWBOX_HEIGHT - ANCHOR_ZIGZAG_MARGIN;
  const travel = bottom - top;
  const wrapped = ((x + offset) % ANCHOR_CYCLE_WIDTH + ANCHOR_CYCLE_WIDTH) % ANCHOR_CYCLE_WIDTH;

  if (wrapped <= ANCHOR_ASCENDING_WIDTH) {
    return bottom - (wrapped / ANCHOR_ASCENDING_WIDTH) * travel;
  }

  return top + ((wrapped - ANCHOR_ASCENDING_WIDTH) / ANCHOR_DESCENDING_WIDTH) * travel;
}

function renderAnchorFrame(offset) {
  const centerX = ANCHOR_VIEWBOX_WIDTH / 2;
  const offsetWithStart = (offset + (ANCHOR_CYCLE_WIDTH - (centerX % ANCHOR_CYCLE_WIDTH))) % ANCHOR_CYCLE_WIDTH;
  const startX = -ANCHOR_EDGE_PADDING;
  const endX = ANCHOR_VIEWBOX_WIDTH + ANCHOR_EDGE_PADDING;
  const points = [];

  const startT = startX + offsetWithStart;
  const endT = endX + offsetWithStart;

  points.push(`${startX},${anchorBaseYAt(startX, offsetWithStart)}`);

  const kMin = Math.floor((startT - ANCHOR_ASCENDING_WIDTH) / ANCHOR_CYCLE_WIDTH) - 1;
  const kMax = Math.ceil((endT + ANCHOR_ASCENDING_WIDTH) / ANCHOR_CYCLE_WIDTH) + 1;

  const boundaries = [];
  for (let k = kMin; k <= kMax; k += 1) {
    boundaries.push(k * ANCHOR_CYCLE_WIDTH);
    boundaries.push(k * ANCHOR_CYCLE_WIDTH + ANCHOR_ASCENDING_WIDTH);
  }

  boundaries.sort((a, b) => a - b);
  for (const boundaryT of boundaries) {
    if (boundaryT <= startT || boundaryT >= endT) {
      continue;
    }
    const x = boundaryT - offsetWithStart;
    points.push(`${x},${anchorBaseYAt(x, offsetWithStart)}`);
  }

  points.push(`${endX},${anchorBaseYAt(endX, offsetWithStart)}`);
  anchorPath.setAttribute("d", `M ${points.join(" L ")}`);

  anchorDot.style.left = "50%";
  const centerY = anchorBaseYAt(centerX, offsetWithStart);
  anchorDot.style.top = `${(centerY / ANCHOR_VIEWBOX_HEIGHT) * 100}%`;
}

function anchorOffsetFromPhase(phaseIndex, phaseProgress) {
  if (phaseIndex === 0) {
    return phaseProgress * ANCHOR_ASCENDING_WIDTH;
  }

  return ANCHOR_ASCENDING_WIDTH + phaseProgress * ANCHOR_DESCENDING_WIDTH;
}

function renderAnchorMotion(phaseIndex, phaseProgress) {
  const offset = anchorOffsetFromPhase(phaseIndex, phaseProgress) % ANCHOR_CYCLE_WIDTH;
  renderAnchorFrame(offset);
}

function renderTechniqueVisibility() {
  const isBox = technique === TECHNIQUES.BOX;
  boxGuide.classList.toggle("hidden", !isBox);
  anchorGuide.classList.toggle("hidden", isBox);
  boxPhaseControls.classList.toggle("hidden", !isBox);
}

function renderReadyState() {
  if (technique === TECHNIQUES.BOX) {
    dot.style.left = "0%";
    dot.style.top = "100%";
    return;
  }
  renderAnchorFrame(0);
}

function render() {
  const remainingMs = Math.max(0, totalSessionMs - elapsedMs);
  sessionCountdown.textContent = `Session: ${formatTime(remainingMs)}`;

  if (!running && elapsedMs === 0) {
    phaseLabel.textContent = "Ready";
    phaseCountdown.textContent = "Phase: --";
    renderReadyState();
    return;
  }

  const { phaseIndex, phaseProgress, phaseDurationSeconds, phaseLabel: label } = phaseData(elapsedMs);
  if (technique === TECHNIQUES.BOX) {
    const position = boxDotPosition(phaseProgress, phaseIndex);
    dot.style.left = `${position.x * 100}%`;
    dot.style.top = `${position.y * 100}%`;
  } else {
    renderAnchorMotion(phaseIndex, phaseProgress);
  }

  phaseLabel.textContent = label;
  const phaseRemaining = Math.ceil(phaseDurationSeconds - phaseProgress * phaseDurationSeconds);
  phaseCountdown.textContent = `Phase: ${Math.max(1, phaseRemaining)}s`;
}

function setInputsDisabled(disabled) {
  techniqueSelect.disabled = disabled;
  durationInput.disabled = disabled;
  boxPhaseInput.disabled = disabled;
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
  setInputsDisabled(false);
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

function loadConfigFromInputs() {
  const selectedTechnique = techniqueSelect.value;
  technique = selectedTechnique === TECHNIQUES.ANCHOR ? TECHNIQUES.ANCHOR : TECHNIQUES.BOX;

  const minutes = parsePositiveNumber(durationInput.value, 5);
  const parsedBoxPhase = parsePositiveNumber(boxPhaseInput.value, DEFAULTS.boxPhaseSeconds);

  durationInput.value = String(minutes);
  boxPhaseInput.value = String(parsedBoxPhase);

  totalSessionMs = minutes * 60 * 1000;
  boxPhaseSeconds = parsedBoxPhase;
}

function startOrResume() {
  if (running) {
    return;
  }

  if (elapsedMs === 0) {
    loadConfigFromInputs();
    renderTechniqueVisibility();
  }

  running = true;
  setInputsDisabled(true);
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
techniqueSelect.addEventListener("change", () => {
  if (running || elapsedMs > 0) {
    return;
  }
  technique = techniqueSelect.value === TECHNIQUES.ANCHOR ? TECHNIQUES.ANCHOR : TECHNIQUES.BOX;
  renderTechniqueVisibility();
  render();
});

renderTechniqueVisibility();
render();
