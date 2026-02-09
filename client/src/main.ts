import { Application } from 'pixi.js';
import { Game } from './game/Game';

/**
 * Main entry point for the Deep Mine client.
 * Shows splash screen, then initializes PixiJS and starts the game.
 */

async function startGame() {
  // Create PixiJS Application
  const app = new Application();

  await app.init({
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: 0x000000,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true
  });

  // Replace canvas placeholder
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (canvas && canvas.parentNode) {
    canvas.parentNode.replaceChild(app.canvas, canvas);
  } else {
    document.body.appendChild(app.canvas);
  }

  // Create and initialize the game
  const game = new Game(app);
  await game.init();

  // Handle window resize
  window.addEventListener('resize', () => {
    app.renderer.resize(window.innerWidth, window.innerHeight);
  });

  // Start the game loop
  app.ticker.add((ticker) => {
    game.update(ticker.deltaTime);
  });

  console.log('🎮 Deep Mine started!');
}

function main() {
  const splash = document.getElementById('splash');
  const playBtn = document.getElementById('play-btn');

  if (!splash || !playBtn) {
    // No splash screen, start directly
    startGame().catch(console.error);
    return;
  }

  playBtn.addEventListener('click', () => {
    // Fade out splash
    splash.classList.add('hidden');

    // Start game after fade
    setTimeout(() => {
      splash.remove();
      document.body.style.background = '#000000';
      startGame().catch(console.error);
    }, 600);
  });
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
