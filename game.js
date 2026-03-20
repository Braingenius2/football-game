// =============================================================
//  ⚽  Football Game — Full Game Logic
//  Tech: Vanilla JS + HTML5 Canvas
// =============================================================

// ——— Canvas Setup ———
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// Pitch dimensions (logical units)
const PITCH_W = 800;
const PITCH_H = 500;
canvas.width = PITCH_W;
canvas.height = PITCH_H;

// ——— DOM Elements ———
const playerScoreEl = document.getElementById('player-score');
const opponentScoreEl = document.getElementById('opponent-score');
const timerEl = document.getElementById('timer');
const startScreen = document.getElementById('start-screen');
const gameoverScreen = document.getElementById('gameover-screen');
const resultTitle = document.getElementById('result-title');
const resultText = document.getElementById('result-text');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const goalFlash = document.getElementById('goal-flash');

// ——— Game Constants ———
const GOAL_WIDTH = 10;
const GOAL_HEIGHT = 120;
const GAME_DURATION = 60; // seconds
const PLAYER_RADIUS = 16;
const BALL_RADIUS = 10;
const PLAYER_SPEED = 4.5;
const PLAYER_ACCEL = 0.55;
const PLAYER_DECEL = 0.88;
const BALL_FRICTION = 0.985;
const KICK_FORCE = 7;
const AI_SPEED = 2.6;
const AI_REACTION_DIST = 280;
const KICK_COOLDOWN = 15; // frames before a player can kick again

// ——— Colors ———
const COLORS = {
  pitch: '#2d8a4e',
  pitchDark: '#1f6e3a',
  lines: 'rgba(255, 255, 255, 0.65)',
  player: '#3b82f6',
  playerOutline: '#1d4ed8',
  opponent: '#ef4444',
  opponentOutline: '#b91c1c',
  ball: '#fefefe',
  ballOutline: '#a3a3a3',
  goalPost: '#f5f5f5',
  goalNet: 'rgba(255, 255, 255, 0.12)',
};

// =============================================================
//  Input Handler
// =============================================================
const keys = {};
window.addEventListener('keydown', (e) => {
  keys[e.key] = true;
  // Prevent page scroll with arrow keys
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
    e.preventDefault();
  }
});
window.addEventListener('keyup', (e) => { keys[e.key] = false; });

// Virtual Joystick Controls
const joystickZone = document.getElementById('joystick-zone');
const joystickStick = document.getElementById('joystick-stick');
let joyActive = false;
let joyCenter = { x: 0, y: 0 };
let joyVector = { x: 0, y: 0 };

joystickZone.addEventListener('pointerdown', startJoy);
joystickZone.addEventListener('pointermove', moveJoy);
window.addEventListener('pointerup', endJoy);
window.addEventListener('pointercancel', endJoy);

function startJoy(e) {
  joyActive = true;
  joystickStick.style.transition = 'none';
  const rect = joystickZone.getBoundingClientRect();
  joyCenter = {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2
  };
  moveJoy(e);
}

function moveJoy(e) {
  if (!joyActive) return;
  
  let dx = e.clientX - joyCenter.x;
  let dy = e.clientY - joyCenter.y;
  
  const maxRadius = 40;
  const dist = Math.hypot(dx, dy);
  
  if (dist > maxRadius) {
    dx = (dx / dist) * maxRadius;
    dy = (dy / dist) * maxRadius;
  }
  
  joystickStick.style.transform = `translate(${dx}px, ${dy}px)`;
  
  joyVector.x = dx / maxRadius;
  joyVector.y = dy / maxRadius;
}

function endJoy(e) {
  if (!joyActive) return;
  joyActive = false;
  joystickStick.style.transition = 'transform 0.1s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
  joystickStick.style.transform = `translate(0px, 0px)`;
  joyVector = { x: 0, y: 0 };
}

// =============================================================
//  Sound — Web Audio API (no external files)
// =============================================================
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

/**
 * Play a short "goal scored" sound effect using oscillators.
 */
function playGoalSound() {
  if (!audioCtx) audioCtx = new AudioCtx();
  const now = audioCtx.currentTime;

  // Chord: major triad sweep
  [523.25, 659.25, 783.99].forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.linearRampToValueAtTime(freq * 1.05, now + 0.3);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6 + i * 0.1);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(now + i * 0.06);
    osc.stop(now + 0.8);
  });
}

/**
 * Play a short kick / tap sound.
 */
function playKickSound() {
  if (!audioCtx) audioCtx = new AudioCtx();
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(300, now);
  osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);
  gain.gain.setValueAtTime(0.15, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.12);
}

/**
 * Play a whistle sound for game start / end.
 */
function playWhistleSound() {
  if (!audioCtx) audioCtx = new AudioCtx();
  const now = audioCtx.currentTime;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(3200, now);
  osc.frequency.linearRampToValueAtTime(2800, now + 0.5);
  gain.gain.setValueAtTime(0.08, now);
  gain.gain.setValueAtTime(0.08, now + 0.35);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.6);
}

// =============================================================
//  Player Class
// =============================================================
class Player {
  /**
   * @param {number} x - Starting X position
   * @param {number} y - Starting Y position
   * @param {string} fill - Fill color
   * @param {string} stroke - Stroke color
   * @param {boolean} isAI - Whether this player is AI-controlled
   */
  constructor(x, y, fill, stroke, isAI = false) {
    this.startX = x;
    this.startY = y;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = PLAYER_RADIUS;
    this.fill = fill;
    this.stroke = stroke;
    this.isAI = isAI;
    this.kickCooldown = 0; // frames remaining before can kick
  }

  /** Reset to starting position. */
  reset() {
    this.x = this.startX;
    this.y = this.startY;
    this.vx = 0;
    this.vy = 0;
    this.kickCooldown = 0;
  }

  /**
   * Update position based on keyboard input (human) or AI logic.
   * @param {Ball} ball - Reference to the ball for AI tracking.
   */
  update(ball) {
    // Tick down kick cooldown
    if (this.kickCooldown > 0) this.kickCooldown--;

    if (this.isAI) {
      this._updateAI(ball);
    } else {
      this._updateHuman();
    }

    // Apply velocity
    this.x += this.vx;
    this.y += this.vy;

    // Clamp to pitch boundaries
    this.x = Math.max(this.radius, Math.min(PITCH_W - this.radius, this.x));
    this.y = Math.max(this.radius, Math.min(PITCH_H - this.radius, this.y));
  }

  /** Handle keyboard-based movement. */
  _updateHuman() {
    let ax = 0, ay = 0;
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) ax -= PLAYER_ACCEL;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) ax += PLAYER_ACCEL;
    if (keys['ArrowUp'] || keys['w'] || keys['W']) ay -= PLAYER_ACCEL;
    if (keys['ArrowDown'] || keys['s'] || keys['S']) ay += PLAYER_ACCEL;

    // Joystick movement
    if (joyVector.x !== 0 || joyVector.y !== 0) {
      ax += joyVector.x * PLAYER_ACCEL;
      ay += joyVector.y * PLAYER_ACCEL;
    }

    this.vx += ax;
    this.vy += ay;

    // Speed cap
    const speed = Math.hypot(this.vx, this.vy);
    if (speed > PLAYER_SPEED) {
      this.vx = (this.vx / speed) * PLAYER_SPEED;
      this.vy = (this.vy / speed) * PLAYER_SPEED;
    }

    // Deceleration when no input
    if (ax === 0) this.vx *= PLAYER_DECEL;
    if (ay === 0) this.vy *= PLAYER_DECEL;
  }

  /**
   * Simple AI: move toward ball, kick toward opponent's goal.
   * @param {Ball} ball
   */
  _updateAI(ball) {
    const dx = ball.x - this.x;
    const dy = ball.y - this.y;
    const dist = Math.hypot(dx, dy);

    // AI only chases the ball when it's on the AI's half (right side)
    // or very close to the AI player
    const ballOnAIHalf = ball.x > PITCH_W * 0.48;
    const ballNearby = dist < AI_REACTION_DIST;
    const shouldChase = ballOnAIHalf || (ballNearby && ball.x > PITCH_W * 0.3);

    if (shouldChase && dist > this.radius + ball.radius + 4) {
      // Move toward the ball, but aim slightly ahead
      const speed = AI_SPEED;
      this.vx = (dx / dist) * speed;
      this.vy = (dy / dist) * speed;
    } else if (!shouldChase) {
      // Return to defensive home position on right side
      const homeX = PITCH_W * 0.72;
      const homeY = PITCH_H / 2;
      const hx = homeX - this.x;
      const hy = homeY - this.y;
      const hd = Math.hypot(hx, hy);
      if (hd > 8) {
        this.vx = (hx / hd) * AI_SPEED * 0.6;
        this.vy = (hy / hd) * AI_SPEED * 0.6;
      } else {
        this.vx *= 0.7;
        this.vy *= 0.7;
      }
    } else {
      // Close to ball but not chasing aggressively — slow down
      this.vx *= 0.7;
      this.vy *= 0.7;
    }
  }

  /** Draw the player on the canvas. */
  draw() {
    // Shadow
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + this.radius * 0.6, this.radius * 0.9, this.radius * 0.35, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fill();

    // Body
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.fill;
    ctx.fill();
    ctx.strokeStyle = this.stroke;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Highlight
    ctx.beginPath();
    ctx.arc(this.x - this.radius * 0.3, this.y - this.radius * 0.3, this.radius * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fill();
  }
}

// =============================================================
//  Ball Class
// =============================================================
class Ball {
  constructor() {
    this.radius = BALL_RADIUS;
    this.reset();
  }

  /** Reset ball to center with zero velocity. */
  reset() {
    this.x = PITCH_W / 2;
    this.y = PITCH_H / 2;
    this.vx = 0;
    this.vy = 0;
  }

  /** Update ball position, apply friction, handle wall bounces. */
  update() {
    // Apply friction
    this.vx *= BALL_FRICTION;
    this.vy *= BALL_FRICTION;

    // Stop very slow movement
    if (Math.abs(this.vx) < 0.05) this.vx = 0;
    if (Math.abs(this.vy) < 0.05) this.vy = 0;

    this.x += this.vx;
    this.y += this.vy;

    // Wall bounces — top & bottom
    if (this.y - this.radius < 0) {
      this.y = this.radius;
      this.vy *= -0.7;
    }
    if (this.y + this.radius > PITCH_H) {
      this.y = PITCH_H - this.radius;
      this.vy *= -0.7;
    }

    // Wall bounces — left & right (but not in goal area)
    const goalTop = (PITCH_H - GOAL_HEIGHT) / 2;
    const goalBottom = goalTop + GOAL_HEIGHT;
    const inGoalYRange = this.y > goalTop && this.y < goalBottom;

    if (this.x - this.radius < 0 && !inGoalYRange) {
      this.x = this.radius;
      this.vx *= -0.7;
    }
    if (this.x + this.radius > PITCH_W && !inGoalYRange) {
      this.x = PITCH_W - this.radius;
      this.vx *= -0.7;
    }
  }

  /** Draw the ball on the canvas. */
  draw() {
    // Shadow
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + this.radius * 0.7, this.radius * 0.85, this.radius * 0.3, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fill();

    // Ball body
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.ball;
    ctx.fill();
    ctx.strokeStyle = COLORS.ballOutline;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Pentagon pattern (simplified)
    ctx.beginPath();
    const r2 = this.radius * 0.5;
    for (let i = 0; i < 5; i++) {
      const angle = (Math.PI * 2 / 5) * i - Math.PI / 2;
      const px = this.x + Math.cos(angle) * r2;
      const py = this.y + Math.sin(angle) * r2;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fill();

    // Highlight
    ctx.beginPath();
    ctx.arc(this.x - this.radius * 0.25, this.y - this.radius * 0.3, this.radius * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fill();
  }
}

// =============================================================
//  Collision Detection
// =============================================================

/**
 * Handle collision between a player and the ball.
 * Applies kick force in the direction from player center to ball center.
 * @param {Player} player
 * @param {Ball} ball
 * @returns {boolean} Whether a collision occurred.
 */
function handlePlayerBallCollision(player, ball) {
  const dx = ball.x - player.x;
  const dy = ball.y - player.y;
  const dist = Math.hypot(dx, dy);
  const minDist = player.radius + ball.radius;

  if (dist < minDist && dist > 0) {
    // Normalize direction
    const nx = dx / dist;
    const ny = dy / dist;

    // Always separate ball from player (prevent overlap)
    ball.x = player.x + nx * (minDist + 1);
    ball.y = player.y + ny * (minDist + 1);

    // Only apply kick force if cooldown has expired
    if (player.kickCooldown <= 0) {
      const playerSpeed = Math.hypot(player.vx, player.vy);
      const force = KICK_FORCE + playerSpeed * 0.6;
      ball.vx = nx * force;
      ball.vy = ny * force;
      player.kickCooldown = KICK_COOLDOWN;
      playKickSound();
    }
    return true;
  }
  return false;
}

/**
 * Prevent two players from overlapping.
 * @param {Player} p1
 * @param {Player} p2
 */
function handlePlayerPlayerCollision(p1, p2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dist = Math.hypot(dx, dy);
  const minDist = p1.radius + p2.radius;

  if (dist < minDist && dist > 0) {
    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = minDist - dist;
    // Push both players apart equally
    p1.x -= nx * overlap * 0.5;
    p1.y -= ny * overlap * 0.5;
    p2.x += nx * overlap * 0.5;
    p2.y += ny * overlap * 0.5;
  }
}

// =============================================================
//  Goal Detection
// =============================================================

/**
 * Check if the ball has entered either goal.
 * @param {Ball} ball
 * @returns {'player'|'opponent'|null} Who scored, or null.
 */
function checkGoal(ball) {
  const goalTop = (PITCH_H - GOAL_HEIGHT) / 2;
  const goalBottom = goalTop + GOAL_HEIGHT;

  // Ball enters LEFT goal → opponent scores
  if (ball.x - ball.radius <= 0 && ball.y > goalTop && ball.y < goalBottom) {
    return 'opponent';
  }
  // Ball enters RIGHT goal → player scores
  if (ball.x + ball.radius >= PITCH_W && ball.y > goalTop && ball.y < goalBottom) {
    return 'player';
  }
  return null;
}

// =============================================================
//  Pitch Renderer
// =============================================================

/** Draw the football pitch with all markings. */
function drawPitch() {
  // Background grass with subtle stripe effect
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = i % 2 === 0 ? COLORS.pitch : COLORS.pitchDark;
    ctx.fillRect((PITCH_W / 10) * i, 0, PITCH_W / 10, PITCH_H);
  }

  ctx.strokeStyle = COLORS.lines;
  ctx.lineWidth = 2;

  // Outer boundary
  ctx.strokeRect(2, 2, PITCH_W - 4, PITCH_H - 4);

  // Midfield line
  ctx.beginPath();
  ctx.moveTo(PITCH_W / 2, 2);
  ctx.lineTo(PITCH_W / 2, PITCH_H - 2);
  ctx.stroke();

  // Center circle
  ctx.beginPath();
  ctx.arc(PITCH_W / 2, PITCH_H / 2, 55, 0, Math.PI * 2);
  ctx.stroke();

  // Center dot
  ctx.beginPath();
  ctx.arc(PITCH_W / 2, PITCH_H / 2, 4, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.lines;
  ctx.fill();

  // Penalty areas
  const penW = 100;
  const penH = 220;
  const penTop = (PITCH_H - penH) / 2;

  // Left penalty area
  ctx.strokeRect(2, penTop, penW, penH);
  // Right penalty area
  ctx.strokeRect(PITCH_W - penW - 2, penTop, penW, penH);

  // Goal area (smaller box)
  const goalAreaW = 40;
  const goalAreaH = 130;
  const goalAreaTop = (PITCH_H - goalAreaH) / 2;
  ctx.strokeRect(2, goalAreaTop, goalAreaW, goalAreaH);
  ctx.strokeRect(PITCH_W - goalAreaW - 2, goalAreaTop, goalAreaW, goalAreaH);

  // Penalty spots
  ctx.beginPath();
  ctx.arc(80, PITCH_H / 2, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(PITCH_W - 80, PITCH_H / 2, 3, 0, Math.PI * 2);
  ctx.fill();

  // Corner arcs
  const cornerR = 16;
  [
    [2, 2, 0, Math.PI / 2],
    [PITCH_W - 2, 2, Math.PI / 2, Math.PI],
    [2, PITCH_H - 2, -Math.PI / 2, 0],
    [PITCH_W - 2, PITCH_H - 2, Math.PI, 3 * Math.PI / 2],
  ].forEach(([cx, cy, startA, endA]) => {
    ctx.beginPath();
    ctx.arc(cx, cy, cornerR, startA, endA);
    ctx.stroke();
  });

  // ——— Goals ———
  const goalTop = (PITCH_H - GOAL_HEIGHT) / 2;

  // Left goal (player defends)
  ctx.fillStyle = COLORS.goalNet;
  ctx.fillRect(-GOAL_WIDTH, goalTop, GOAL_WIDTH + 2, GOAL_HEIGHT);
  ctx.strokeStyle = COLORS.goalPost;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(2, goalTop);
  ctx.lineTo(-GOAL_WIDTH, goalTop);
  ctx.lineTo(-GOAL_WIDTH, goalTop + GOAL_HEIGHT);
  ctx.lineTo(2, goalTop + GOAL_HEIGHT);
  ctx.stroke();

  // Right goal (opponent defends)
  ctx.fillStyle = COLORS.goalNet;
  ctx.fillRect(PITCH_W - 2, goalTop, GOAL_WIDTH + 2, GOAL_HEIGHT);
  ctx.strokeStyle = COLORS.goalPost;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(PITCH_W - 2, goalTop);
  ctx.lineTo(PITCH_W + GOAL_WIDTH, goalTop);
  ctx.lineTo(PITCH_W + GOAL_WIDTH, goalTop + GOAL_HEIGHT);
  ctx.lineTo(PITCH_W - 2, goalTop + GOAL_HEIGHT);
  ctx.stroke();
}

// =============================================================
//  Game State
// =============================================================
let player, opponent, ball;
let playerScore = 0;
let opponentScore = 0;
let timeLeft = GAME_DURATION;
let timerInterval = null;
let gameRunning = false;
let animFrameId = null;

/** Initialize / reset all game objects. */
function initGame() {
  player = new Player(PITCH_W * 0.25, PITCH_H / 2, COLORS.player, COLORS.playerOutline);
  opponent = new Player(PITCH_W * 0.75, PITCH_H / 2, COLORS.opponent, COLORS.opponentOutline, true);
  ball = new Ball();
  playerScore = 0;
  opponentScore = 0;
  timeLeft = GAME_DURATION;
  updateHUD();
}

/** Update the on-screen HUD elements. */
function updateHUD() {
  playerScoreEl.textContent = playerScore;
  opponentScoreEl.textContent = opponentScore;
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  timerEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
  timerEl.classList.toggle('warning', timeLeft <= 10);
}

/** Show the goal celebration flash. */
function showGoalFlash() {
  goalFlash.classList.remove('hidden');
  // Force reflow to restart animation
  goalFlash.offsetHeight;
  goalFlash.style.animation = 'none';
  goalFlash.offsetHeight;
  goalFlash.style.animation = '';
  setTimeout(() => goalFlash.classList.add('hidden'), 1000);
}

/** Called when a goal is scored. */
function onGoal(scorer) {
  if (scorer === 'player') {
    playerScore++;
  } else {
    opponentScore++;
  }
  playGoalSound();
  showGoalFlash();
  updateHUD();

  // Reset positions
  ball.reset();
  player.reset();
  opponent.reset();
}

/** End the game and show results. */
function endGame() {
  gameRunning = false;
  clearInterval(timerInterval);
  cancelAnimationFrame(animFrameId);
  playWhistleSound();

  let title = '🤝 Draw!';
  if (playerScore > opponentScore) title = '🏆 You Win!';
  else if (opponentScore > playerScore) title = '😞 You Lose';

  resultTitle.textContent = title;
  resultText.textContent = `Final Score: ${playerScore} – ${opponentScore}`;
  gameoverScreen.classList.remove('hidden');
}

// =============================================================
//  Game Loop
// =============================================================

/** Update all game entities. */
function update() {
  player.update(ball);
  opponent.update(ball);
  ball.update();

  // Collision detection
  handlePlayerBallCollision(player, ball);
  handlePlayerBallCollision(opponent, ball);
  handlePlayerPlayerCollision(player, opponent);

  // Goal detection
  const scorer = checkGoal(ball);
  if (scorer) {
    onGoal(scorer);
  }
}

/** Render everything to the canvas. */
function render() {
  ctx.clearRect(0, 0, PITCH_W, PITCH_H);
  drawPitch();
  player.draw();
  opponent.draw();
  ball.draw();
}

/** Main game loop driven by requestAnimationFrame. */
function gameLoop() {
  if (!gameRunning) return;
  update();
  render();
  animFrameId = requestAnimationFrame(gameLoop);
}

/** Start or restart the game. */
function startGame() {
  initGame();
  gameRunning = true;

  playWhistleSound();

  // Start countdown timer
  timerInterval = setInterval(() => {
    timeLeft--;
    updateHUD();
    if (timeLeft <= 0) {
      endGame();
    }
  }, 1000);

  gameLoop();
}

// =============================================================
//  Event Listeners
// =============================================================
startBtn.addEventListener('click', () => {
  startScreen.classList.add('hidden');
  startGame();
});

restartBtn.addEventListener('click', () => {
  gameoverScreen.classList.add('hidden');
  startGame();
});

// Draw initial state on the pitch (before game starts)
initGame();
render();
