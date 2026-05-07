# Neon Dash - AGENTS.md

## Project Type
Single-page browser game (vanilla JS, no build step)

## Developer Commands
- `pnpm run dev` - Start local server on port 3000
- Open `index.html` directly in browser (no build needed)

## Entry Point
`game.js` - Contains all game logic, rendering, and controls

## Key Files
- `index.html` - Canvas and UI markup
- `style.css` - Neon styling
- `game.js` - Game loop, physics, collision, audio

## Notes
- Score and sound toggle persisted to localStorage
- No tests, lint, or typecheck configured
- No CI workflows present