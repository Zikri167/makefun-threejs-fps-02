/*
 * Cinderworks Yard submission entrypoint.
 * Package the local game and captures, then write the judge dossier.
 */
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-threejs.ts';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDirectory = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const DOSSIER_LIMITS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
};

function handInGame(destination) {
  const gameSource = join(projectRoot, 'game');
  const gameDestination = join(destination, 'game');
  const screenshotSource = join(projectRoot, 'screenshots');
  const screenshotDestination = join(destination, 'screenshots');

  mkdirSync(destination, { recursive: true });
  cpSync(gameSource, gameDestination, { recursive: true });
  mkdirSync(screenshotDestination, { recursive: true });
  if (existsSync(screenshotSource)) {
    cpSync(screenshotSource, screenshotDestination, { recursive: true });
  }

  const dossier = buildDossier(destination, DOSSIER_LIMITS);
  writeFileSync(join(destination, 'dossier.json'), dossier);
}

handInGame(outputDirectory);
