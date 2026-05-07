# Neon Dash - Game Specification

## Project Overview
- **Name**: Neon Dash
- **Type**: Browser-based arcade game
- **Core Functionality**: One-button endless runner where player jumps/dashes to avoid obstacles
- **Target Users**: Casual gamers looking for quick, addictive gameplay

## Visual & Rendering Specification

### Scene Setup
- **Canvas**: Full viewport, responsive
- **Background**: Dark gradient (#0a0a0f to #1a1a2e) with subtle grid lines
- **Color Palette**: Neon cyan (#0ff), neon magenta (#f0f), neon yellow (#ff0), white accents

### Player Character
- **Shape**: Square (30x30px)
- **Color**: Neon cyan with glow effect (box-shadow)
- **States**: Idle (pulse), Jumping (stretch), Dashing (blur trail)

### Obstacles
- **Types**:
  1. Ground spikes (triangular, neon magenta)
  2. Floating orbs (circular, neon yellow)
  3. Double barrier (two blocks, one high one low)
- **Spawn**: Random patterns with increasing frequency

### Effects
- **Particles**: On jump (cyan), on score milestone (gold), on death (magenta explosion)
- **Screen Shake**: On collision (5px displacement, 200ms duration)
- **Glow**: CSS box-shadow on all neon elements
- **Trail**: Ghost effect when dashing

### UI Elements
- **Score Display**: Top-center, large neon font
- **Best Score**: Top-right, smaller
- **Instructions Screen**: Center overlay with controls explanation
- **Game Over Screen**: Center overlay with score and restart prompt

## Gameplay Specification

### Controls
- **Jump**: Spacebar or Left Click or Tap (mobile)
- **Dash**: Shift key or Right Click (invincibility for 200ms)

### Mechanics
- **Gravity**: 0.6px/frame
- **Jump Force**: -12px initial velocity
- **Dash Speed**: 2x normal speed for 200ms
- **Base Speed**: 5px/frame, increases by 0.5 every 500 points
- **Obstacle Spawn**: Every 1500-2500ms (decreases with difficulty)

### Scoring
- +1 point per frame survived
- +50 bonus for passing an obstacle
- Best score saved to localStorage

### Difficulty Progression
- Speed increases every 500 points
- Obstacle frequency increases
- New obstacle types unlock at 1000, 2500, 5000 points

### Game States
1. **Instructions**: Show on first load, dismiss on any input
2. **Playing**: Active gameplay
3. **Game Over**: Show score, prompt restart

## Audio Specification

### Web Audio
- **Jump**: Short synth blip (200Hz, 50ms)
- **Dash**: Whoosh sound (noise + filter sweep)
- **Score**: Quick ascending tone (400Hz to 800Hz)
- **Death**: Low impact sound (100Hz, decay)
- **Background**: None (keeps it simple)

### Sound Toggle
- Mute button in top-left corner
- State saved to localStorage

## Acceptance Criteria
1. Game loads within 2 seconds
2. Instructions readable in under 5 seconds
3. Controls responsive (< 16ms input lag)
4. Score persists across page reloads
5. Sound can be toggled on/off
6. Screen shake triggers on death
7. Particles visible on jump and death
8. Difficulty noticeably increases every 500 points
9. Works on Chrome, Firefox, Safari
10. No console errors during normal gameplay