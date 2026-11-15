export function createHud() {
  const element = (id) => document.getElementById(id);
  const overlay = element('overlay');
  const buy = element('buy');
  const feed = element('feed');
  const banner = element('banner');
  const hitmarker = element('hitmarker');
  let hitTimer = 0;
  let feedTimer = 0;
  let playHandler = null;
  let buyHandler = null;

  element('play').addEventListener('click', () => playHandler && playHandler());
  document.querySelectorAll('[data-weapon]').forEach((button) => {
    button.addEventListener('click', () => buyHandler && buyHandler(button.dataset.weapon));
  });

  return {
    onPlay(handler) {
      playHandler = handler;
    },
    onBuy(handler) {
      buyHandler = handler;
    },
    showOverlay(mode) {
      element('overlay-title').textContent = mode === 'paused' ? 'CINDERWORKS · PAUSED' : 'CINDERWORKS YARD';
      element('overlay-copy').textContent = mode === 'paused'
        ? 'Deployment paused. Click to return to the yard.'
        : 'Industrial yard operations. Ember carries the Spark charge; Ash holds the line.';
      element('play').textContent = mode === 'paused' ? 'RESUME' : 'DEPLOY';
      overlay.hidden = false;
    },
    hideOverlay() {
      overlay.hidden = true;
    },
    showBuy(visible) {
      buy.hidden = !visible;
    },
    update(data) {
      element('round').textContent = `ROUND ${data.round} · ${data.phase.toUpperCase()}`;
      element('timer').textContent = String(Math.max(0, Math.ceil(data.time)));
      element('score').textContent = `EMBER ${data.emberWins} — ${data.ashWins} ASH`;
      element('health').textContent = String(data.health);
      element('ammo-mag').textContent = String(data.mag);
      element('ammo-reserve').textContent = `/ ${data.reserve} · ${data.weapon}`;
      element('alive').textContent = `EMBER ${data.emberAlive} | ASH ${data.ashAlive}`;
      element('cash').textContent = `$${data.money}`;
      element('bomb').textContent = data.bomb;
      element('crosshair').style.setProperty('--spread', `${4 + data.spread * 900}px`);
      if (data.feed !== feed.dataset.value) {
        feed.dataset.value = data.feed;
        feed.textContent = data.feed;
        feed.classList.toggle('on', Boolean(data.feed));
        clearTimeout(feedTimer);
        feedTimer = setTimeout(() => feed.classList.remove('on'), 3600);
      }
      banner.hidden = !data.banner;
      if (data.banner) {
        element('banner-title').textContent = data.banner.title;
        element('banner-copy').textContent = data.banner.reason;
      }
    },
    hitMarker(killed) {
      hitmarker.classList.toggle('kill', killed);
      hitmarker.classList.add('on');
      clearTimeout(hitTimer);
      hitTimer = setTimeout(() => hitmarker.classList.remove('on'), 110);
    },
  };
}
