import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { createWorld } from './world.js';
import { createInput } from './input.js';
import { createPlayer } from './player.js';
import { createWeapon, WEAPONS } from './weapon.js';
import { createBots } from './bots.js';
import { createAudio } from './audio.js';
import { createGame } from './game.js';
import { createHud } from './hud.js';

const FIXED_STEP = 1 / 60;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number.parseInt(params.get('seed') ?? '1', 10) || 1;

function makeRandom(initial) {
  let value = initial;
  return function random() {
    value |= 0;
    value = (value + 0x6d2b79f5) | 0;
    let next = Math.imul(value ^ (value >>> 15), 1 | value);
    next = (next + Math.imul(next ^ (next >>> 7), 61 | next)) ^ next;
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

const random = makeRandom(seed);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.canvas);
scene.fog = new THREE.Fog(PALETTE.canvas, 32, 76);
const camera = new THREE.PerspectiveCamera(76, window.innerWidth / window.innerHeight, 0.05, 120);
scene.add(camera);
const world = createWorld(scene);
const player = createPlayer(world.colliders);
const weapon = createWeapon(camera);
const audio = createAudio();
const hud = createHud();
const input = createInput(renderer.domElement, onLockChange);
const raycaster = new THREE.Raycaster();
raycaster.far = 90;
const shotDirection = new THREE.Vector3();
const bots = createBots(scene, world, random, onBotShot);
const game = createGame(world, player, bots, weapon, audio);
let elapsed = 0;
let accumulator = 0;
let lastTime = performance.now();
let frozen = false;
let started = false;
let grenadeTime = 0;
let grenadeMesh = null;
let bannerTimer = 0;

hud.onPlay(() => {
  if (game.state.phase === 'matchEnd' || game.state.phase === 'menu') resetMatch();
  audio.shot();
  input.requestLock();
});
hud.onBuy((name) => {
  game.buy(name);
});
game.state.onRoundEnd = () => {
  game.state.endTime = 4;
  bannerTimer = 4;
};

function onLockChange(locked) {
  if (locked) {
    started = true;
    hud.hideOverlay();
  } else if (started && game.state.phase !== 'matchEnd') {
    hud.showOverlay('paused');
  }
}

function resetMatch() {
  game.beginMatch();
  player.reset(new THREE.Vector3(-19, 0, 14));
  weapon.equip('Sidearm');
  hud.hideOverlay();
}

function syncCamera() {
  const body = player.state;
  camera.position.set(body.position.x, body.position.y + body.eye, body.position.z);
  camera.rotation.set(body.pitch, body.yaw, 0, 'YXZ');
}

function aimAt(point) {
  const origin = camera.position;
  const delta = new THREE.Vector3().subVectors(point, origin);
  const distance = delta.length();
  player.state.yaw = Math.atan2(-delta.x, -delta.z);
  player.state.pitch = Math.asin(THREE.MathUtils.clamp(delta.y / distance, -1, 1));
  syncCamera();
}

function fire(spread = weapon.spread(player.groundSpeed())) {
  if (weapon.state.mag === 0 && weapon.state.reloadLeft === 0) weapon.reload();
  if (!weapon.ready() || !weapon.takeRound()) return;
  const spec = weapon.spec();
  let hitAny = false;
  for (let pellet = 0; pellet < spec.pellets; pellet += 1) {
    camera.getWorldDirection(shotDirection);
    shotDirection.x += (random() * 2 - 1) * spread;
    shotDirection.y += (random() * 2 - 1) * spread;
    shotDirection.z += (random() * 2 - 1) * spread;
    shotDirection.normalize();
    scene.updateMatrixWorld(true);
    raycaster.set(camera.position, shotDirection);
    const hit = raycaster.intersectObjects([...world.shootables, ...bots.bots.filter((bot) => bot.alive).flatMap((bot) => [bot.body, bot.head])], false)[0];
    if (!hit || !hit.object.userData.bot) continue;
    const bot = hit.object.userData.bot;
    if (bot.team === player.state.team) continue;
    const head = hit.object.userData.part === 'head';
    const killed = bots.damage(bot, spec.damage * (head ? 4 : 1));
    audio.hit();
    hud.hitMarker(killed);
    game.addFeed(`EMBER 1  ›  ASH ${bot.index + 1}${head ? ' · HEADSHOT' : ''}`);
    if (killed) game.addKillReward();
    hitAny = true;
  }
  if (!hitAny) audio.shot();
  weapon.pullTrigger();
  player.recoil(0.008 + random() * 0.009, (random() * 2 - 1) * 0.005);
}

function onBotShot(bot, target) {
  if (target.player) {
    const dead = player.damage(8 + Math.floor(random() * 10));
    game.addFeed(`ASH ${bot.index + 1}  ›  EMBER 1`);
    if (dead) player.state.team = 'Ash';
    return;
  }
  bots.damage(target, 18 + Math.floor(random() * 12));
}

function throwSpark() {
  if (game.state.phase !== 'live' || !weapon.state.grenade) return;
  weapon.state.grenade = false;
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 10, 8),
    new THREE.MeshStandardMaterial({ color: PALETTE.accent, emissive: PALETTE.accent }),
  );
  mesh.position.copy(camera.position);
  scene.add(mesh);
  grenadeMesh = mesh;
  grenadeTime = 1.3;
}

function updateGrenade(dt) {
  if (!grenadeMesh) return;
  grenadeTime -= dt;
  grenadeMesh.position.add(new THREE.Vector3(0, -2.7 * dt, -8 * dt).applyEuler(camera.rotation));
  if (grenadeTime <= 0) {
    for (const bot of bots.alive()) {
      if (bot.root.position.distanceTo(grenadeMesh.position) < 5) bots.damage(bot, 70);
    }
    scene.remove(grenadeMesh);
    grenadeMesh.geometry.dispose();
    grenadeMesh.material.dispose();
    grenadeMesh = null;
  }
}

function currentBombLabel() {
  const objective = game.state.objective;
  if (objective.detonated) return 'CHARGE DETONATED · SITE A';
  if (objective.plantedAt !== null) {
    if (objective.defuseProgress > 0) return `DEFUSING ${Math.floor(objective.defuseProgress / 5 * 100)}% · ${Math.ceil(objective.plantedAt)}s`;
    return `CHARGE LIVE · ${Math.ceil(objective.plantedAt)}s · SITE ${objective.site.name}`;
  }
  if (objective.plantProgress > 0) return `PLANTING ${Math.floor(objective.plantProgress / 3 * 100)}%`;
  return 'CHARGE: CARRIED · HOLD E AT SITE A OR B';
}

function updateHud() {
  const state = game.state;
  const emberAlive = bots.alive('Ember').length + Number(player.state.alive && player.state.team !== 'Ash');
  const ashAlive = bots.alive('Ash').length + Number(!player.state.alive && player.state.team === 'Ash');
  const banner = state.phase === 'roundEnd' || state.phase === 'matchEnd'
    ? { title: state.winner === 'Ember' ? 'ROUND WON' : 'ROUND LOST', reason: state.reason }
    : null;
  hud.update({
    round: state.round,
    phase: state.phase,
    time: state.objective.plantedAt === null ? state.time : state.objective.plantedAt,
    emberWins: state.wins.Ember,
    ashWins: state.wins.Ash,
    health: player.state.health,
    mag: weapon.state.mag,
    reserve: weapon.state.reserve,
    weapon: weapon.state.name,
    emberAlive,
    ashAlive,
    money: state.money,
    spread: weapon.spread(player.groundSpeed()),
    bomb: currentBombLabel(),
    feed: state.killFeed[0] || '',
    banner,
  });
  hud.showBuy(state.phase === 'buy');
}

function simulationStep(dt) {
  elapsed += dt;
  player.step(dt, input.state.keys);
  weapon.step(dt);
  game.step(dt, input.state.keys);
  updateGrenade(dt);
  bannerTimer = Math.max(0, bannerTimer - dt);
  if (input.takePressed('KeyR')) {
    weapon.reload();
    audio.reload();
  }
  if (input.takePressed('KeyB')) hud.showBuy(game.state.phase === 'buy');
  if (input.takePressed('Digit1')) weapon.equip('Sidearm');
  if (input.takePressed('Digit2')) weapon.equip('VK-7');
  if (input.takePressed('Digit3')) weapon.equip('Hornet-9');
  if (input.takePressed('KeyG')) throwSpark();
  if (input.state.firing && weapon.ready()) fire();
  syncCamera();
  updateHud();
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  if (!frozen) {
    if (input.state.locked) {
      const look = input.takeLook();
      player.look(look.x, look.y);
      accumulator += dt;
      let steps = 0;
      while (accumulator >= FIXED_STEP && steps < 6) {
        simulationStep(FIXED_STEP);
        accumulator -= FIXED_STEP;
        steps += 1;
      }
      if (accumulator > FIXED_STEP * 6) accumulator = 0;
    }
  }
  renderer.render(scene, camera);
}

function settle(steps) {
  for (let index = 0; index < steps; index += 1) simulationStep(FIXED_STEP);
}

function runShot(name) {
  resetMatch();
  player.state.position.set(4, 0, 4);
  player.state.yaw = 0;
  settle(6);
  if (name === 'buy') {
    game.state.phase = 'buy';
    game.state.buyTime = 8;
    hud.showBuy(true);
  } else if (name === 'play') {
    game.startRound();
    player.state.position.set(4, 0, 4);
    player.state.yaw = -0.45;
    settle(4);
  } else if (name === 'end') {
    game.state.wins.Ember = 1;
    game.state.money += 3250;
    game.state.objective.plantedAt = null;
    game.state.objective.site = world.sites[0];
    game.state.objective.detonated = true;
    game.state.phase = 'roundEnd';
    game.state.winner = 'Ember';
    game.state.reason = 'Charge detonated at Site A';
    game.state.endTime = 4;
  } else {
    game.state.phase = 'menu';
    hud.showBuy(false);
    hud.showOverlay('start');
  }
  syncCamera();
  updateHud();
  if (name === 'start') hud.showOverlay('start');
  let painted = 0;
  function paint() {
    requestAnimationFrame(paint);
    syncCamera();
    renderer.render(scene, camera);
    painted += 1;
    if (painted === 2) {
      window.__shotReady = true;
      frozen = true;
    }
  }
  requestAnimationFrame(paint);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

if (shot) {
  runShot(shot);
} else {
  hud.showOverlay('start');
  requestAnimationFrame(frame);
}
