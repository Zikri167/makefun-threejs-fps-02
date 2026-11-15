import * as THREE from 'three';
import { PALETTE } from './palette.js';

export const WEAPONS = {
  Sidearm: { cost: 0, damage: 26, gap: 0.22, spread: 0.008, mag: 12, reserve: 48, reload: 1.35, pellets: 1 },
  'VK-7': { cost: 2700, damage: 31, gap: 0.105, spread: 0.005, mag: 30, reserve: 90, reload: 1.8, pellets: 1 },
  'Hornet-9': { cost: 1500, damage: 21, gap: 0.075, spread: 0.009, mag: 32, reserve: 96, reload: 1.55, pellets: 1 },
  'Breach-12': { cost: 1100, damage: 14, gap: 0.72, spread: 0.055, mag: 6, reserve: 24, reload: 2.1, pellets: 8 },
  Longshot: { cost: 4750, damage: 82, gap: 1.05, spread: 0.0018, mag: 5, reserve: 20, reload: 2.3, pellets: 1 },
};

export function createWeapon(camera) {
  const metal = new THREE.MeshStandardMaterial({ color: PALETTE.hairline, roughness: 0.45, metalness: 0.42 });
  const light = new THREE.MeshStandardMaterial({ color: PALETTE.ink, roughness: 0.62, metalness: 0.2 });
  const model = new THREE.Group();
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.11, 0.42), metal);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.42, 8), light);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.02, -0.37);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.2), metal);
  stock.position.z = 0.28;
  model.add(receiver, barrel, stock);
  model.position.set(0.24, -0.2, -0.42);
  camera.add(model);

  const flash = new THREE.PointLight(PALETTE.accent, 0, 4);
  flash.position.set(0.2, -0.15, -0.65);
  camera.add(flash);
  const state = { name: 'Sidearm', mag: 12, reserve: 48, cooldown: 0, reloadLeft: 0, flash: 0, kick: 0, grenade: false };

  function equip(name) {
    const spec = WEAPONS[name];
    if (!spec) return false;
    state.name = name;
    state.mag = spec.mag;
    state.reserve = spec.reserve;
    state.cooldown = 0;
    state.reloadLeft = 0;
    return true;
  }

  function step(dt) {
    state.cooldown = Math.max(0, state.cooldown - dt);
    state.flash = Math.max(0, state.flash - dt);
    state.kick += (0 - state.kick) * Math.min(1, dt * 15);
    model.position.z = -0.42 + state.kick;
    model.rotation.x = state.kick * 2;
    flash.intensity = state.flash > 0 ? 16 : 0;
    if (state.reloadLeft > 0) {
      state.reloadLeft = Math.max(0, state.reloadLeft - dt);
      if (state.reloadLeft === 0) {
        const spec = WEAPONS[state.name];
        const amount = Math.min(spec.mag - state.mag, state.reserve);
        state.mag += amount;
        state.reserve -= amount;
      }
    }
  }

  return {
    state,
    step,
    spec() {
      return WEAPONS[state.name];
    },
    ready() {
      return state.mag > 0 && state.cooldown <= 0 && state.reloadLeft <= 0;
    },
    takeRound() {
      if (state.mag <= 0) return false;
      state.mag -= 1;
      return true;
    },
    pullTrigger() {
      state.cooldown = WEAPONS[state.name].gap;
      state.flash = 0.055;
      state.kick = 0.07;
    },
    reload() {
      const spec = WEAPONS[state.name];
      if (state.reloadLeft > 0 || state.mag >= spec.mag || state.reserve <= 0) return;
      state.reloadLeft = spec.reload;
    },
    spread(speed) {
      return WEAPONS[state.name].spread + Math.min(1, speed / 5.3) * 0.026 + state.kick * 0.04;
    },
    equip,
    refill() {
      state.mag = WEAPONS[state.name].mag;
      state.reserve = WEAPONS[state.name].reserve;
      state.cooldown = 0;
      state.reloadLeft = 0;
      state.grenade = false;
    },
  };
}
