import * as THREE from 'three';

const RADIUS = 0.36;
const STAND_HEIGHT = 1.74;
const CROUCH_HEIGHT = 1.18;

export function createPlayer(colliders, spawn = new THREE.Vector3(-19, 0, 14)) {
  const state = {
    position: spawn.clone(),
    velocity: new THREE.Vector3(),
    yaw: 0,
    pitch: 0,
    eye: 1.62,
    height: STAND_HEIGHT,
    crouching: false,
    onGround: true,
    health: 100,
    alive: true,
    team: 'Ember',
  };
  const probe = new THREE.Box3();
  const wish = new THREE.Vector3();

  function overlaps(x, y, z, height) {
    probe.min.set(x - RADIUS, y + 0.03, z - RADIUS);
    probe.max.set(x + RADIUS, y + height - 0.03, z + RADIUS);
    return colliders.some((collider) => probe.intersectsBox(collider));
  }

  function look(dx, dy, sensitivity = 0.0022) {
    state.yaw -= dx * sensitivity;
    state.pitch = THREE.MathUtils.clamp(state.pitch - dy * sensitivity, -1.48, 1.48);
  }

  function recoil(pitch, yaw) {
    state.pitch = THREE.MathUtils.clamp(state.pitch + pitch, -1.48, 1.48);
    state.yaw += yaw;
  }

  function step(dt, keys) {
    const crouching = keys.has('ControlLeft') || keys.has('ControlRight');
    state.crouching = crouching;
    const targetHeight = crouching ? CROUCH_HEIGHT : STAND_HEIGHT;
    if (targetHeight > state.height && overlaps(state.position.x, state.position.y, state.position.z, targetHeight)) {
      state.crouching = true;
    } else {
      state.height = targetHeight;
    }
    const eyeTarget = state.crouching ? 1.08 : 1.62;
    state.eye += (eyeTarget - state.eye) * Math.min(1, dt * 12);

    const forward = Number(keys.has('KeyW')) - Number(keys.has('KeyS'));
    const strafe = Number(keys.has('KeyD')) - Number(keys.has('KeyA'));
    wish.set(0, 0, 0);
    if (forward || strafe) {
      const sin = Math.sin(state.yaw);
      const cos = Math.cos(state.yaw);
      wish.set(-sin * forward + cos * strafe, 0, -cos * forward - sin * strafe).normalize();
    }
    const speed = state.crouching ? 2.3 : 5.3;
    const accel = state.onGround ? 32 : 8;
    state.velocity.x += (wish.x * speed - state.velocity.x) * Math.min(1, accel * dt / speed);
    state.velocity.z += (wish.z * speed - state.velocity.z) * Math.min(1, accel * dt / speed);
    if (state.onGround && wish.lengthSq() === 0) {
      state.velocity.x *= Math.max(0, 1 - 9 * dt);
      state.velocity.z *= Math.max(0, 1 - 9 * dt);
    }
    if (keys.has('Space') && state.onGround) {
      state.velocity.y = 6.3;
      state.onGround = false;
    }
    state.velocity.y -= 20 * dt;

    const nextX = state.position.x + state.velocity.x * dt;
    if (!overlaps(nextX, state.position.y, state.position.z, state.height)) state.position.x = nextX;
    else state.velocity.x = 0;
    const nextZ = state.position.z + state.velocity.z * dt;
    if (!overlaps(state.position.x, state.position.y, nextZ, state.height)) state.position.z = nextZ;
    else state.velocity.z = 0;
    state.position.y += state.velocity.y * dt;
    if (state.position.y <= 0) {
      state.position.y = 0;
      state.velocity.y = 0;
      state.onGround = true;
    } else {
      state.onGround = false;
    }
  }

  return {
    state,
    step,
    look,
    recoil,
    damage(amount) {
      state.health = Math.max(0, state.health - amount);
      state.alive = state.health > 0;
      return !state.alive;
    },
    reset(position) {
      state.position.copy(position);
      state.velocity.set(0, 0, 0);
      state.health = 100;
      state.alive = true;
      state.team = 'Ember';
      state.height = STAND_HEIGHT;
    },
    groundSpeed() {
      return Math.hypot(state.velocity.x, state.velocity.z);
    },
  };
}
