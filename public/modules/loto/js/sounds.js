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
  const NUMBER_REPEAT = 2;
  const NUMBER_GAP_MS = 2000;

  function numberSound(n) {
    const num = Number(n);
    if (!num || num < 1 || num > 90) return null;
    if (!numbers[num]) {
      try {
        if (typeof Howl === 'undefined') return null;
        numbers[num] = new Howl({
          src: [`${moduleRoot}/assets/sounds/numbers/${num}.mp3`],
          volume: 0.85,
          preload: true,
          html5: true,
        });
      } catch (_) {
        numbers[num] = null;
      }
    }
    return numbers[num];
  }

  function playNumberTimes(n, times, gapMs) {
    const howl = numberSound(n);
    if (!howl) return;
    const total = Math.max(1, Number(times) || 1);
    const gap = Math.max(0, Number(gapMs) || 0);
    let left = total;
    const playOnce = () => {
      if (left <= 0) return;
      left -= 1;
      try {
        howl.stop();
        const id = howl.play();
        if (left > 0) {
          howl.once(
            'end',
            () => {
              if (gap > 0) setTimeout(playOnce, gap);
              else playOnce();
            },
            id
          );
        }
      } catch (_) {
        /* silent */
      }
    };
    playOnce();
  }

  return {
    playClick() {
      click?.play?.();
    },
    playVictory() {
      victory?.play?.();
    },
    playNumber(n) {
      playNumberTimes(n, NUMBER_REPEAT, NUMBER_GAP_MS);
    },
  };
};
