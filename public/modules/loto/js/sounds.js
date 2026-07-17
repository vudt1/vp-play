window.Loto = window.Loto || {};

Loto.createSfx = function createSfx(moduleRoot) {
  function makeHowl(file, volume, preload) {
    try {
      if (typeof Howl === 'undefined') return null;
      let ref = new Howl({
        src: [`${moduleRoot}/assets/sounds/${file}`],
        volume: volume ?? 0.55,
        preload: preload !== false,
        html5: true,
        onloaderror: () => {
          ref = null;
        },
      });
      return {
        play() {
          try {
            ref?.play?.();
          } catch (_) {
            /* silent */
          }
        },
        stop() {
          try {
            ref?.stop?.();
          } catch (_) {
            /* silent */
          }
        },
      };
    } catch (_) {
      return null;
    }
  }

  const click = makeHowl('click.mp3', 0.45, true);
  const victory = makeHowl('victory.mp3', 0.7, true);
  const numbers = {};

  function numberSound(n) {
    const num = Number(n);
    if (!num || num < 1 || num > 90) return null;
    if (!numbers[num]) {
      numbers[num] = makeHowl(`numbers/${num}.mp3`, 0.85, true);
    }
    return numbers[num];
  }

  return {
    playClick() {
      click?.play?.();
    },
    playVictory() {
      victory?.play?.();
    },
    playNumber(n) {
      numberSound(n)?.play?.();
    },
  };
};
