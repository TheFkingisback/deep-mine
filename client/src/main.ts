import { Application } from 'pixi.js';
import { Game } from './game/Game';

/**
 * Main entry point for the Deep Mine client.
 * Initializes PixiJS Application and starts the game.
 */

async function main() {
  // Create PixiJS Application
  const app = new Application();

  // Initialize the application with configuration
  await app.init({
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: 0x000000,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true
  });

  // Append canvas to the body
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

  console.log('🎮 Deep Mine client started!');
}

// Start the application
main().catch((error) => {
  console.error('Failed to start Deep Mine:', error);
});
