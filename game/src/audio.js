export function createAudio() {
  let context = null;

  function unlock() {
    if (!context) context = new AudioContext();
    if (context.state === 'suspended') context.resume();
  }

  function tone(frequency, duration, type = 'sine', volume = 0.035, endFrequency = frequency) {
    unlock();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), context.currentTime + duration);
    gain.gain.setValueAtTime(volume, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
  }

  return {
    shot() {
      tone(120, 0.09, 'sawtooth', 0.025, 42);
    },
    reload() {
      tone(520, 0.055, 'square', 0.018, 280);
    },
    hit() {
      tone(980, 0.045, 'triangle', 0.022, 720);
    },
    plant() {
      tone(760, 0.16, 'sine', 0.025, 920);
    },
    explosion() {
      tone(90, 0.8, 'sawtooth', 0.08, 24);
    },
    result(won) {
      tone(won ? 520 : 220, 0.42, 'triangle', 0.04, won ? 860 : 120);
    },
  };
}
