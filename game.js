(function() {
  'use strict';

  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  
  const scoreDisplay = document.getElementById('score-display');
  const bestDisplay = document.getElementById('best-display');
  const instructionsScreen = document.getElementById('instructions-screen');
  const gameoverScreen = document.getElementById('gameover-screen');
  const finalScoreValue = document.getElementById('final-score-value');
  const finalBestValue = document.getElementById('final-best-value');
  const newBestText = document.getElementById('new-best-text');
  const soundToggle = document.getElementById('sound-toggle');

  let width, height;
  let animationId;
  let lastTime = 0;
  let accumulator = 0;
  const FIXED_DT = 1 / 60;

  const GRAVITY = 0.65;
  const JUMP_FORCE = -14;
  const DASH_DURATION = 180;
  const BASE_SPEED = 4;
  const SPEED_INCREMENT = 0.3;
  const SPEED_INCREASE_SCORE = 400;

  const COLORS = {
    cyan: '#0ff',
    magenta: '#f0f',
    yellow: '#ff0',
    white: '#fff',
    green: '#0f0',
    orange: '#f80',
    purple: '#a0f'
  };

  const POWERUP_TYPES = {
    shield: { color: COLORS.green, symbol: '🛡', duration: 0 },
    slowmo: { color: COLORS.yellow, symbol: '⏱', duration: 5000 },
    double: { color: COLORS.orange, symbol: '×2', duration: 8000 },
    ghost: { color: COLORS.purple, symbol: '👻', duration: 3000 }
  };

  let gameState = 'instructions';
  let score = 0;
  let scoreDisplayY = 0;
  let bestScore = parseInt(localStorage.getItem('neonDashBest')) || 0;
  let soundEnabled = localStorage.getItem('neonDashSound') !== 'false';
  let speed = BASE_SPEED;
  let obstacleTimer = 0;
  let nextObstacleTime = 1800;
  let comboCount = 0;
  let lastScoreTime = 0;
  let flashAlpha = 0;
  let deathTimer = 0;
  let speedLines = [];

  let audioCtx = null;
  let shakeAmount = 0;
  let shakeDuration = 0;
  let musicOsc = null;
  let musicGain = null;
  let musicPlaying = false;
  let musicNoteIndex = 0;
  let musicTimer = 0;

  const MUSIC_NOTES = [
    220, 0, 220, 0, 262, 0, 220, 0, 330, 0, 262, 0, 220, 0, 196,
    196, 0, 196, 0, 247, 0, 196, 0, 294, 0, 247, 0, 196, 0, 175,
    220, 0, 330, 0, 392, 0, 330, 0, 440, 0, 392, 0, 330, 0, 262,
    262, 0, 294, 0, 330, 0, 294, 0, 262, 0, 220, 0, 196, 0, 220
  ];
  const NOTE_DURATION = 0.12;

  const player = {
    x: 100,
    y: 0,
    width: 30,
    height: 30,
    velocityY: 0,
    grounded: false,
    dashing: false,
    dashTimer: 0,
    trail: [],
    jumpsLeft: 2,
    maxJumps: 2,
    hasShield: false,
    slowmo: false,
    doubleScore: false,
    ghost: false,
    powerupTimer: 0
  };

  let obstacles = [];
  let powerups = [];
  let particles = [];
  let scorePopups = [];
  let groundY = 0;

  function initAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function startMusic() {
    if (!audioCtx || musicPlaying || !soundEnabled) return;
    musicGain = audioCtx.createGain();
    musicGain.gain.value = 0.12;
    musicGain.connect(audioCtx.destination);
    musicPlaying = true;
    musicNoteIndex = 0;
    musicTimer = 0;
  }

  function stopMusic() {
    musicPlaying = false;
    if (musicGain) {
      musicGain.disconnect();
      musicGain = null;
    }
  }

  function updateMusic(dt) {
    if (!musicPlaying || !soundEnabled) return;
    musicTimer += dt;
    if (musicTimer >= NOTE_DURATION) {
      musicTimer = 0;
      const note = MUSIC_NOTES[musicNoteIndex];
      musicNoteIndex = (musicNoteIndex + 1) % MUSIC_NOTES.length;
      if (note > 0) {
        const osc = audioCtx.createOscillator();
        const noteGain = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.value = note;
        osc.connect(noteGain);
        noteGain.connect(musicGain);
        noteGain.gain.setValueAtTime(0.5, audioCtx.currentTime);
        noteGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + NOTE_DURATION * 0.9);
        osc.start();
        osc.stop(audioCtx.currentTime + NOTE_DURATION);
      }
    }
  }

  function playSound(type) {
    if (!soundEnabled || !audioCtx) return;
    
    const now = audioCtx.currentTime;
    
    if (type === 'jump') {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.1);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    }
    
    if (type === 'dash') {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const filter = audioCtx.createBiquadFilter();
      osc.type = 'sawtooth';
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2000, now);
      filter.frequency.exponentialRampToValueAtTime(200, now + 0.2);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.2);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    }
    
    if (type === 'score') {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.08);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    }
    
    if (type === 'death') {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'square';
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.3);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    }

    if (type === 'milestone') {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.setValueAtTime(523, now);
      osc.frequency.setValueAtTime(659, now + 0.1);
      osc.frequency.setValueAtTime(784, now + 0.2);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    }

    if (type === 'powerup') {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(880, now + 0.1);
      osc.frequency.setValueAtTime(1320, now + 0.2);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    }
  }

  function spawnParticles(x, y, color, count, spread = 5) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * spread * 2,
        vy: (Math.random() - 0.5) * spread * 2 - 2,
        life: 1,
        decay: 0.02 + Math.random() * 0.02,
        size: 3 + Math.random() * 4,
        color: color
      });
    }
  }

  function triggerShake(amount, duration) {
    shakeAmount = amount;
    shakeDuration = duration;
  }

  function resize() {
    const container = document.getElementById('game-container');
    width = container.clientWidth;
    height = container.clientHeight;
    canvas.width = width;
    canvas.height = height;
    groundY = height - 80;
    player.y = groundY - player.height;
  }

  function resetGame() {
    player.x = 100;
    player.y = groundY - player.height;
    player.velocityY = 0;
    player.grounded = true;
    player.dashing = false;
    player.dashTimer = 0;
    player.trail = [];
    player.jumpsLeft = player.maxJumps;
    player.hasShield = false;
    player.slowmo = false;
    player.doubleScore = false;
    player.ghost = false;
    player.powerupTimer = 0;
    
    obstacles = [];
    powerups = [];
    particles = [];
    scorePopups = [];
    speedLines = [];
    score = 0;
    comboCount = 0;
    speed = BASE_SPEED;
    obstacleTimer = 0;
    nextObstacleTime = 1800;
    shakeAmount = 0;
    shakeDuration = 0;
    flashAlpha = 0;
    deathTimer = 0;
    scoreDisplayY = 0;
    
    scoreDisplay.textContent = '0';
  }

  function startGame() {
    initAudio();
    gameState = 'playing';
    instructionsScreen.classList.add('hidden');
    gameoverScreen.classList.add('hidden');
    resetGame();
    startMusic();
  }

  function endGame() {
    stopMusic();
    gameState = 'dying';
    deathTimer = 0.4;
    playSound('death');
    triggerShake(12, 400);
    spawnParticles(player.x + player.width / 2, player.y + player.height / 2, COLORS.magenta, 40, 10);
    flashAlpha = 0.8;
    
    const isNewBest = score > bestScore;
    if (isNewBest) {
      bestScore = score;
      localStorage.setItem('neonDashBest', bestScore);
    }
    
    finalScoreValue.textContent = score;
    finalBestValue.textContent = bestScore;
    newBestText.classList.toggle('hidden', !isNewBest);
    bestDisplay.textContent = `BEST: ${bestScore}`;
    
    gameoverScreen.classList.remove('hidden');
  }

  function spawnObstacle() {
    const types = ['spike', 'orb', 'double'];
    const unlockedTypes = types.slice(0, Math.min(3, Math.floor(score / 800) + 1));
    const type = unlockedTypes[Math.floor(Math.random() * unlockedTypes.length)];
    
    let obstacle;
    
    if (type === 'spike') {
      obstacle = {
        type: 'spike',
        x: width + 50,
        y: groundY - 30,
        width: 30 + Math.random() * 10,
        height: 30 + Math.random() * 10,
        passed: false
      };
    } else if (type === 'orb') {
      obstacle = {
        type: 'orb',
        x: width + 30,
        y: groundY - 90 - Math.random() * 100,
        radius: 12 + Math.random() * 6,
        passed: false
      };
    } else {
      obstacle = {
        type: 'double',
        x: width + 50,
        y: groundY - 25,
        width: 25 + Math.random() * 8,
        height: 25,
        topY: groundY - 140,
        topHeight: 25,
        passed: false
      };
    }
    
    obstacles.push(obstacle);
  }

  function spawnPowerup() {
    const types = Object.keys(POWERUP_TYPES);
    const type = types[Math.floor(Math.random() * types.length)];
    const config = POWERUP_TYPES[type];
    
    const powerup = {
      type: type,
      x: width + 50,
      y: groundY - 60 - Math.random() * 100,
      radius: 18,
      collected: false,
      pulse: 0
    };
    
    powerups.push(powerup);
  }

  function checkCollision(obs) {
    if (player.dashing || player.ghost) return false;
    
    if (obs.type === 'spike') {
      return player.x < obs.x + obs.width &&
             player.x + player.width > obs.x &&
             player.y < obs.y + obs.height &&
             player.y + player.height > obs.y;
    }
    
    if (obs.type === 'orb') {
      const px = player.x + player.width / 2;
      const py = player.y + player.height / 2;
      const dx = px - obs.x;
      const dy = py - obs.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      return dist < obs.radius + player.width / 2 - 5;
    }
    
    if (obs.type === 'double') {
      const hitBottom = player.x < obs.x + obs.width &&
                        player.x + player.width > obs.x &&
                        player.y < obs.y + obs.height &&
                        player.y + player.height > obs.y;
      const hitTop = player.x < obs.x + obs.width &&
                    player.x + player.width > obs.x &&
                    player.y < obs.topY + obs.topHeight &&
                    player.y + player.height > obs.topY;
      return hitBottom || hitTop;
    }
    
    return false;
  }

  function update(dt) {
    if (gameState === 'dying') {
      deathTimer -= dt;
      if (deathTimer <= 0) {
        gameState = 'gameover';
      }
      return;
    }
    
    if (gameState !== 'playing') return;
    
    score += Math.floor(dt * 60);
    scoreDisplay.textContent = score;
    
    if (score - scoreDisplayY > 50) {
      scoreDisplayY = score;
      scoreDisplay.style.transform = 'scale(1.2)';
      setTimeout(() => scoreDisplay.style.transform = 'scale(1)', 100);
    }
    
    const targetSpeed = BASE_SPEED + Math.floor(score / SPEED_INCREASE_SCORE) * SPEED_INCREMENT;
    speed = Math.min(targetSpeed, 11);
    
    if (speed > 6 && Math.random() < 0.3) {
      speedLines.push({
        x: width,
        y: Math.random() * height,
        length: 50 + Math.random() * 100,
        alpha: 0.3 + Math.random() * 0.3,
        speed: speed * 2
      });
    }
    
    if (player.grounded) {
      player.velocityY += GRAVITY * 0.5;
    } else {
      player.velocityY += GRAVITY;
    }
    
    player.y += player.velocityY;
    
    if (player.y >= groundY - player.height) {
      player.y = groundY - player.height;
      player.velocityY = 0;
      player.grounded = true;
      player.jumpsLeft = player.maxJumps;
    } else {
      player.grounded = false;
    }
    
    if (player.dashing) {
      player.dashTimer -= dt * 1000;
      if (player.dashTimer <= 0) {
        player.dashing = false;
      }
      player.trail.push({ x: player.x, y: player.y, alpha: 1 });
      if (player.trail.length > 8) player.trail.shift();
    } else {
      player.trail = player.trail.filter(t => {
        t.alpha -= 0.15;
        return t.alpha > 0;
      });
    }
    
    obstacleTimer += dt * 1000;
    if (obstacleTimer >= nextObstacleTime) {
      spawnObstacle();
      obstacleTimer = 0;
      const difficulty = Math.min(3, score / 1500);
      const minTime = Math.max(600, 1800 - difficulty * 300);
      const maxTime = Math.max(900, 2200 - difficulty * 350);
      nextObstacleTime = minTime + Math.random() * (maxTime - minTime);
      
      if (score > 300 && Math.random() < 0.15) {
        spawnPowerup();
      }
    }
    
    obstacles.forEach(obs => {
      obs.x -= speed;
      
      if (!obs.passed && obs.x + (obs.width || obs.radius * 2) < player.x) {
        obs.passed = true;
        const now = Date.now();
        if (now - lastScoreTime < 500) {
          comboCount++;
        } else {
          comboCount = 1;
        }
        lastScoreTime = now;
        
        const difficultyBonus = obs.type === 'double' ? 25 : obs.type === 'orb' ? 15 : 0;
        const bonus = 50 + difficultyBonus + (comboCount > 1 ? comboCount * 10 : 0);
        const finalBonus = player.doubleScore ? bonus * 2 : bonus;
        score += finalBonus;
        playSound('score');
        
        if (score % 500 < 60) {
          playSound('milestone');
          spawnParticles(width / 2, height / 2, COLORS.green, 20, 5);
        }
        
        spawnParticles(obs.x + (obs.width || obs.radius * 2), obs.y, COLORS.yellow, 8, 3);
        
        scorePopups.push({
          x: player.x + player.width / 2,
          y: player.y - 20,
          text: '+' + bonus,
          alpha: 1,
          vy: -1
        });
      }
    });
    
    obstacles = obstacles.filter(obs => obs.x > -100);
    
    powerups.forEach(p => {
      p.x -= speed * 0.8;
      p.pulse += 0.15;
      
      if (!p.collected) {
        const dx = (player.x + player.width / 2) - p.x;
        const dy = (player.y + player.height / 2) - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < p.radius + player.width / 2) {
          p.collected = true;
          activatePowerup(p.type);
        }
      }
    });
    powerups = powerups.filter(p => p.x > -50 && !p.collected);
    
    if (player.powerupTimer > 0) {
      player.powerupTimer -= dt * 1000;
      if (player.powerupTimer <= 0) {
        player.hasShield = false;
        player.slowmo = false;
        player.doubleScore = false;
        player.ghost = false;
      }
    }
    
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1;
      p.life -= p.decay;
    });
    particles = particles.filter(p => p.life > 0);
    
    scorePopups.forEach(p => {
      p.y += p.vy;
      p.alpha -= 0.02;
    });
    scorePopups = scorePopups.filter(p => p.alpha > 0);
    
    speedLines.forEach(l => {
      l.x -= l.speed;
      l.alpha -= 0.01;
    });
    speedLines = speedLines.filter(l => l.alpha > 0);
    
    if (flashAlpha > 0) flashAlpha -= 0.05;
    
    if (shakeDuration > 0) {
      shakeDuration -= dt * 1000;
    } else {
      shakeAmount = 0;
    }
    
    for (const obs of obstacles) {
      if (checkCollision(obs)) {
        endGame();
        return;
      }
    }
  }

  function drawGrid() {
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    const gridSize = 40;
    
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  function drawGround() {
    ctx.fillStyle = 'rgba(0, 255, 255, 0.1)';
    ctx.fillRect(0, groundY, width, height - groundY);
    
    ctx.strokeStyle = COLORS.cyan;
    ctx.lineWidth = 3;
    ctx.shadowColor = COLORS.cyan;
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(width, groundY);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  function drawPlayer() {
    player.trail.forEach(t => {
      ctx.globalAlpha = t.alpha * 0.5;
      ctx.fillStyle = COLORS.cyan;
      ctx.shadowColor = COLORS.cyan;
      ctx.shadowBlur = 10;
      ctx.fillRect(t.x, t.y, player.width, player.height);
    });
    ctx.globalAlpha = 1;
    
    ctx.fillStyle = player.dashing ? COLORS.white : COLORS.cyan;
    ctx.shadowColor = player.dashing ? COLORS.white : COLORS.cyan;
    ctx.shadowBlur = player.dashing ? 40 : 25;
    
    const stretch = player.dashing ? 1.4 : 1;
    const squash = player.dashing ? 0.7 : 1;
    const drawW = player.width * stretch;
    const drawH = player.height * squash;
    const drawX = player.x + (player.width - drawW) / 2;
    const drawY = player.y + (player.height - drawH);
    
    ctx.fillRect(drawX, drawY, drawW, drawH);
    
    if (player.dashing) {
      ctx.strokeStyle = COLORS.white;
      ctx.lineWidth = 3;
      ctx.shadowBlur = 20;
      ctx.strokeRect(drawX - 3, drawY - 3, drawW + 6, drawH + 6);
    }
    
    ctx.shadowBlur = 0;
    
    if (!player.grounded && !player.dashing) {
      ctx.fillStyle = 'rgba(0, 255, 255, 0.3)';
      ctx.fillRect(drawX - 5, drawY + drawH, drawW + 10, 5);
    }
  }

  function drawObstacles() {
    obstacles.forEach(obs => {
      if (obs.type === 'spike') {
        ctx.fillStyle = COLORS.magenta;
        ctx.shadowColor = COLORS.magenta;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.moveTo(obs.x, obs.y + obs.height);
        ctx.lineTo(obs.x + obs.width / 2, obs.y);
        ctx.lineTo(obs.x + obs.width, obs.y + obs.height);
        ctx.closePath();
        ctx.fill();
      }
      
      if (obs.type === 'orb') {
        ctx.fillStyle = COLORS.yellow;
        ctx.shadowColor = COLORS.yellow;
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(obs.x, obs.y, obs.radius, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = 'rgba(255, 255, 0, 0.5)';
        ctx.beginPath();
        ctx.arc(obs.x - 3, obs.y - 3, obs.radius * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      
      if (obs.type === 'double') {
        ctx.fillStyle = COLORS.magenta;
        ctx.shadowColor = COLORS.magenta;
        ctx.shadowBlur = 15;
        ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
        ctx.fillRect(obs.x, obs.topY, obs.width, obs.topHeight);
      }
      
      ctx.shadowBlur = 0;
    });
  }

  function drawPowerups() {
    powerups.forEach(p => {
      if (p.collected) return;
      const config = POWERUP_TYPES[p.type];
      const pulse = Math.sin(p.pulse) * 0.2 + 1;
      
      ctx.fillStyle = config.color;
      ctx.shadowColor = config.color;
      ctx.shadowBlur = 20 * pulse;
      
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * pulse, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(config.symbol, p.x, p.y);
      
      ctx.shadowBlur = 0;
    });
  }

  function drawParticles() {
    particles.forEach(p => {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  function drawScorePopups() {
    ctx.font = 'bold 24px Courier New';
    ctx.textAlign = 'center';
    scorePopups.forEach(p => {
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = COLORS.yellow;
      ctx.shadowColor = COLORS.yellow;
      ctx.shadowBlur = 10;
      ctx.fillText(p.text, p.x, p.y);
    });
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  function drawSpeedLines() {
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    speedLines.forEach(l => {
      ctx.globalAlpha = l.alpha;
      ctx.beginPath();
      ctx.moveTo(l.x, l.y);
      ctx.lineTo(l.x + l.length, l.y);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }

  function drawVignette() {
    const gradient = ctx.createRadialGradient(width / 2, height / 2, height * 0.3, width / 2, height / 2, height);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  function drawFlash() {
    if (flashAlpha > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
      ctx.fillRect(0, 0, width, height);
    }
  }

  function render() {
    ctx.save();
    
    if (shakeAmount > 0 && gameState !== 'dying') {
      const shakeX = (Math.random() - 0.5) * shakeAmount * 2;
      const shakeY = (Math.random() - 0.5) * shakeAmount * 2;
      ctx.translate(shakeX, shakeY);
    }
    
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, width, height);
    
    drawGrid();
    drawSpeedLines();
    drawGround();
    drawObstacles();
    drawPowerups();
    drawPlayer();
    drawParticles();
    drawScorePopups();
    drawVignette();
    drawFlash();
    
    ctx.restore();
  }

  function gameLoop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
    lastTime = timestamp;
    
    updateMusic(dt);
    accumulator += dt;
    
    while (accumulator >= FIXED_DT) {
      update(FIXED_DT);
      accumulator -= FIXED_DT;
    }
    
    render();
    animationId = requestAnimationFrame(gameLoop);
  }

  function jump() {
    if (gameState === 'playing' && player.jumpsLeft > 0) {
      player.velocityY = player.grounded ? JUMP_FORCE : JUMP_FORCE * 0.9;
      player.grounded = false;
      player.jumpsLeft--;
      playSound('jump');
      spawnParticles(player.x + player.width / 2, player.y + player.height, COLORS.cyan, 5, 2);
    }
  }

  function activatePowerup(type) {
    const config = POWERUP_TYPES[type];
    playSound('powerup');
    spawnParticles(player.x + player.width / 2, player.y + player.height / 2, config.color, 15, 5);
    
    player.hasShield = type === 'shield';
    player.slowmo = type === 'slowmo';
    player.doubleScore = type === 'double';
    player.ghost = type === 'ghost';
    player.powerupTimer = config.duration;
    
    scorePopups.push({
      x: player.x + player.width / 2,
      y: player.y - 30,
      text: config.symbol,
      alpha: 1.5,
      vy: -1
    });
  }

  function dash() {
    if (gameState === 'playing' && !player.dashing) {
      player.dashing = true;
      player.dashTimer = DASH_DURATION;
      playSound('dash');
      spawnParticles(player.x + player.width / 2, player.y + player.height / 2, COLORS.white, 8, 3);
    }
  }

  function handleInput(e) {
    if (gameState === 'instructions') {
      startGame();
      return;
    }
    
    if (gameState === 'gameover') {
      startGame();
      return;
    }
    
    if (e.type === 'keydown') {
      if (e.code === 'Space') {
        e.preventDefault();
        jump();
      }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        dash();
      }
    }
  }

  function handleClick(e) {
    if (e.target === soundToggle) return;
    
    if (gameState === 'instructions') {
      startGame();
      return;
    }
    
    if (gameState === 'gameover') {
      startGame();
      return;
    }
    
    jump();
  }

  function handleRightClick(e) {
    e.preventDefault();
    if (gameState === 'playing') {
      dash();
    }
  }

  function toggleSound() {
    soundEnabled = !soundEnabled;
    localStorage.setItem('neonDashSound', soundEnabled);
    soundToggle.textContent = soundEnabled ? '🔊' : '🔇';
    if (soundEnabled) {
      initAudio();
    }
  }

  window.addEventListener('keydown', handleInput);
  canvas.addEventListener('click', handleClick);
  canvas.addEventListener('contextmenu', handleRightClick);
  soundToggle.addEventListener('click', toggleSound);
  window.addEventListener('resize', resize);

  resize();
  bestDisplay.textContent = `BEST: ${bestScore}`;
  lastTime = performance.now();
  animationId = requestAnimationFrame(gameLoop);
})();