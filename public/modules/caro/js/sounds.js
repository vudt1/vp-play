window.Caro = window.Caro || {};

Caro.createSfx = function createSfx(moduleRoot) {
  function makeHowl(file, volume) {
    try {
      if (typeof Howl === 'undefined') return null;
      let ref = new Howl({
        src: [`${moduleRoot}/assets/sounds/${file}`],
        volume: volume ?? 0.55,
        preload: true,
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
      };
    } catch (_) {
      return null;
    }
  }

  const place = makeHowl('place.mp3', 0.55);
  const win = makeHowl('win.mp3', 0.65);
  const lose = makeHowl('lose.mp3', 0.65);

  return {
    playPlace() {
      place?.play?.();
    },
    playWin() {
      win?.play?.();
    },
    playLose() {
      lose?.play?.();
    },
    mute(on) {
      try {
        if (typeof Howler !== 'undefined') Howler.mute(!!on);
      } catch (_) {
        /* ignore */
      }
    },
  };
};

Caro.createPlaceSound = Caro.createSfx;
