import * as THREE from 'three';
import { PALETTE } from './palette.js';

export function createBots(scene, world, random, onShot) {
  const bots = [];
  const bodyGeometry = new THREE.CapsuleGeometry(0.34, 0.92, 4, 8);
  const headGeometry = new THREE.SphereGeometry(0.22, 10, 8);
  const emberMaterial = new THREE.MeshStandardMaterial({ color: PALETTE.accent, roughness: 0.7 });
  const ashMaterial = new THREE.MeshStandardMaterial({ color: PALETTE.hairline, roughness: 0.76 });
  const headMaterial = new THREE.MeshStandardMaterial({ color: PALETTE.ink, roughness: 0.8 });
  const raycaster = new THREE.Raycaster();
  const direction = new THREE.Vector3();
  const eyeOffset = new THREE.Vector3(0, 1.2, 0);
  const hitOffset = new THREE.Vector3(0, 1, 0);

  function makeBot(team, index, position) {
    const root = new THREE.Group();
    const body = new THREE.Mesh(bodyGeometry, team === 'Ember' ? emberMaterial : ashMaterial);
    body.position.y = 0.82;
    body.castShadow = true;
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 1.58;
    head.castShadow = true;
    root.add(body, head);
    root.position.copy(position);
    scene.add(root);
    const bot = {
      team,
      index,
      root,
      body,
      head,
      health: 100,
      alive: true,
      routeIndex: index % 3,
      waypoint: 0,
      reaction: 0.3 + random() * 0.7,
      cooldown: random() * 0.6,
      retreat: 0,
    };
    body.userData.bot = bot;
    body.userData.part = 'body';
    head.userData.bot = bot;
    head.userData.part = 'head';
    bots.push(bot);
    return bot;
  }

  const emberSpawns = [
    new THREE.Vector3(-19, 0, 14),
    new THREE.Vector3(-16, 0, 16),
    new THREE.Vector3(-21, 0, 10),
    new THREE.Vector3(-13, 0, 15),
  ];
  const ashSpawns = [
    new THREE.Vector3(19, 0, -14),
    new THREE.Vector3(16, 0, -16),
    new THREE.Vector3(21, 0, -10),
    new THREE.Vector3(13, 0, -15),
    new THREE.Vector3(18, 0, -10),
  ];
  emberSpawns.forEach((position, index) => makeBot('Ember', index, position));
  ashSpawns.forEach((position, index) => makeBot('Ash', index, position));

  function alive(team) {
    return bots.filter((bot) => bot.alive && (!team || bot.team === team));
  }

  function damage(bot, amount) {
    if (!bot || !bot.alive) return false;
    bot.health = Math.max(0, bot.health - amount);
    if (bot.health === 0) {
      bot.alive = false;
      bot.root.visible = false;
      return true;
    }
    bot.retreat = 2.5;
    return false;
  }

  function canSee(bot, targetPosition) {
    direction.subVectors(targetPosition, bot.root.position);
    direction.y += 0.55;
    const distance = direction.length();
    direction.normalize();
    raycaster.set(bot.root.position.clone().add(eyeOffset), direction);
    raycaster.far = distance;
    return !raycaster.intersectObjects(world.shootables, false).length;
  }

  function chooseTarget(bot, player) {
    const candidates = bot.team === 'Ash'
      ? [{ player: true, position: player.position, alive: player.alive }, ...alive('Ember')]
      : alive('Ash');
    let bestTarget = null;
    let bestPosition = null;
    let bestDistance = 24;
    for (const candidate of candidates) {
      if (!candidate.alive) continue;
      const position = candidate.player ? candidate.position : candidate.root.position;
      const distance = bot.root.position.distanceTo(position);
      if (distance >= bestDistance || !canSee(bot, position)) continue;
      bestTarget = candidate;
      bestPosition = position;
      bestDistance = distance;
    }
    return { target: bestTarget, position: bestPosition, distance: bestDistance };
  }

  function step(dt, player, objective) {
    for (const bot of bots) {
      if (!bot.alive) continue;
      bot.cooldown = Math.max(0, bot.cooldown - dt);
      bot.reaction = Math.max(0, bot.reaction - dt);
      bot.retreat = Math.max(0, bot.retreat - dt);
      const sight = chooseTarget(bot, player);
      const target = sight.target;
      if (target && bot.reaction <= 0 && bot.cooldown === 0) {
        const accuracy = THREE.MathUtils.clamp(0.72 - sight.distance * 0.018, 0.22, 0.64);
        if (random() < accuracy) onShot(bot, target, target.player ? null : target);
        bot.cooldown = 0.42 + random() * 0.34;
        bot.reaction = 0.18 + random() * 0.24;
        bot.root.lookAt(sight.position.x, bot.root.position.y, sight.position.z);
      }

      const route = world.routes[bot.team === 'Ember' ? 'ember' : 'ash'];
      let destination = route[(bot.waypoint + bot.routeIndex) % route.length];
      if (target && bot.retreat <= 0) destination = sight.position;
      if (bot.retreat > 0) destination = bot.root.position.clone().sub(new THREE.Vector3(0, 0, 1));
      direction.subVectors(destination, bot.root.position);
      direction.y = 0;
      const distance = direction.length();
      if (distance > 1.2 && (!target || bot.retreat > 0)) {
        direction.normalize();
        bot.root.position.addScaledVector(direction, Math.min(distance, 2.2 * dt));
        bot.root.rotation.y = Math.atan2(direction.x, direction.z);
      } else if (distance < 1.2 && !target) {
        bot.waypoint = (bot.waypoint + 1) % route.length;
      }
      if (bot.team === 'Ember' && objective.plantedAt === null && bot.root.position.distanceTo(world.sites[0].position) < 2.2) {
        objective.botPlant = true;
      }
      if (bot.team === 'Ash' && objective.plantedAt !== null && bot.root.position.distanceTo(objective.site.position) < 2.3) {
        objective.botDefuse = true;
      }
    }
  }

  function reset() {
    bots.forEach((bot) => {
      bot.alive = true;
      bot.health = 100;
      bot.root.visible = true;
      const spawns = bot.team === 'Ember' ? emberSpawns : ashSpawns;
      bot.root.position.copy(spawns[bot.index]);
      bot.waypoint = 0;
      bot.cooldown = 0.4;
      bot.reaction = 0.5;
      bot.retreat = 0;
    });
  }

  return { bots, alive, damage, step, reset };
}
