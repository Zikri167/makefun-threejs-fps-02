import * as THREE from 'three';
import { WEAPONS } from './weapon.js';

export function createGame(world, player, bots, weapon, audio) {
  const state = {
    phase: 'menu',
    round: 1,
    wins: { Ember: 0, Ash: 0 },
    money: 800,
    time: 100,
    playerTeam: 'Ember',
    objective: { carrier: player.state, plantedAt: null, site: null, plantProgress: 0, defuseProgress: 0, botPlant: false, botDefuse: false },
    reason: '',
    winner: '',
    killFeed: [],
    onRoundEnd: null,
  };

  function startRound() {
    state.phase = 'live';
    state.time = 100;
    state.reason = '';
    state.winner = '';
    state.objective = { carrier: player.state, plantedAt: null, site: null, plantProgress: 0, defuseProgress: 0, botPlant: false, botDefuse: false };
    bots.reset();
  }

  function beginMatch() {
    state.phase = 'buy';
    state.buyTime = 8;
    state.round = 1;
    state.wins.Ember = 0;
    state.wins.Ash = 0;
    state.money = 800;
    state.time = 100;
  }

  function finishRound(winner, reason) {
    if (state.phase !== 'live') return;
    state.phase = 'roundEnd';
    state.winner = winner;
    state.reason = reason;
    state.wins[winner] += 1;
    state.money += winner === state.playerTeam ? 3250 : 1900;
    state.endTime = 4;
    audio.result(winner === state.playerTeam);
    if (state.onRoundEnd) state.onRoundEnd(winner, reason);
  }

  function buy(name) {
    if (state.phase !== 'buy') return false;
    if (name === 'Spark') {
      if (state.money < 300 || weapon.state.grenade) return false;
      state.money -= 300;
      weapon.state.grenade = true;
      return true;
    }
    const spec = WEAPONS[name];
    if (!spec || state.money < spec.cost) return false;
    state.money -= spec.cost;
    weapon.equip(name);
    return true;
  }

  function step(dt, keys) {
    if (state.phase === 'buy') {
      state.buyTime -= dt;
      if (state.buyTime <= 0) startRound();
      return;
    }
    if (state.phase === 'roundEnd') {
      state.endTime -= dt;
      if (state.wins.Ember >= 5 || state.wins.Ash >= 5 || state.round >= 9) {
        state.phase = 'matchEnd';
      } else if (state.endTime <= 0) {
        state.round += 1;
        player.reset(new THREE.Vector3(-19, 0, 14));
        weapon.refill();
        state.phase = 'buy';
        state.buyTime = 8;
      }
      return;
    }
    if (state.phase !== 'live') return;
    state.time -= dt;
    state.objective.botPlant = false;
    state.objective.botDefuse = false;
    bots.step(dt, player.state, state.objective);

    if (state.objective.botPlant && state.objective.plantedAt === null) {
      state.objective.plantProgress += dt;
      if (state.objective.plantProgress >= 3) {
        state.objective.site = world.sites[0];
        state.objective.plantedAt = 35;
        state.objective.carrier = null;
        state.objective.plantProgress = 0;
        audio.plant();
      }
    }

    const emberAlive = bots.alive('Ember').length + Number(player.state.alive && state.playerTeam === 'Ember');
    const ashAlive = bots.alive('Ash').length;
    if (!player.state.alive && state.objective.plantedAt === null) state.objective.carrier = null;
    if (keys.has('KeyE') && state.objective.plantedAt === null && state.objective.carrier && player.state.alive) {
      const site = world.sites.find((entry) => entry.position.distanceTo(player.state.position) <= entry.radius);
      if (site) {
        state.objective.site = site;
        state.objective.plantProgress += dt;
        if (state.objective.plantProgress >= 3) {
          state.objective.plantedAt = 35;
          state.objective.carrier = null;
          state.objective.plantProgress = 0;
          audio.plant();
        }
      } else {
        state.objective.plantProgress = 0;
      }
    } else if (state.objective.plantedAt === null && !state.objective.botPlant) {
      state.objective.plantProgress = 0;
    }

    if (state.objective.plantedAt !== null) {
      state.objective.plantedAt -= dt;
      if (state.objective.botDefuse) {
        state.objective.defuseProgress += dt;
        if (state.objective.defuseProgress >= 5) {
          finishRound('Ash', 'Charge defused');
          return;
        }
      }
      if (keys.has('KeyE') && state.playerTeam === 'Ash' && player.state.alive && player.state.position.distanceTo(state.objective.site.position) < 2.8) {
        state.objective.defuseProgress += dt;
        if (state.objective.defuseProgress >= 5) {
          finishRound('Ash', 'Charge defused');
          return;
        }
      } else if (!state.objective.botDefuse) {
        state.objective.defuseProgress = 0;
      }
      if (state.objective.plantedAt <= 0) {
        audio.explosion();
        finishRound('Ember', 'Charge detonated');
        return;
      }
    }

    if (emberAlive <= 0) finishRound('Ash', 'Ember eliminated');
    else if (ashAlive <= 0 && state.objective.plantedAt === null) finishRound('Ember', 'Ash eliminated');
    else if (state.time <= 0 && state.objective.plantedAt === null) finishRound('Ash', 'Time expired');
  }

  return {
    state,
    beginMatch,
    startRound,
    step,
    buy,
    addKillReward() {
      state.money += 300;
    },
    addFeed(line) {
      state.killFeed.unshift(line);
      state.killFeed.length = Math.min(state.killFeed.length, 4);
    },
  };
}
