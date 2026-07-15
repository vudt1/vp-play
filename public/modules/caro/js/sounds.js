window.Caro = window.Caro || {};

Caro.createPlaceSound = function createPlaceSound(moduleRoot) {
  let placeSound = null;
  try {
    if (typeof Howl === 'undefined') return { play() {} };
    placeSound = new Howl({
      src: [`${moduleRoot}/assets/sounds/place.mp3`],
      volume: 0.55,
      preload: true,
      html5: true,
      onloaderror: () => {
        placeSound = null;
      },
    });
  } catch (_) {
    placeSound = null;
  }
  return {
    play() {
      try {
        placeSound?.play?.();
      } catch (_) {
        /* silent */
      }
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
