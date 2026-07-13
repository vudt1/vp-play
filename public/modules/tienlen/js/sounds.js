(function (global) {
  const SoundManager = {
    sounds: {},
    ready: false,

    init(basePath) {
      const root = basePath.replace(/\/+$/, '');
      const src = (name) => [`${root}/assets/sounds/${name}.mp3`];
      this.sounds = {
        deal: new Howl({ src: src('deal'), volume: 0.5 }),
        flip: new Howl({ src: src('flip'), volume: 0.6 }),
        win: new Howl({ src: src('win'), volume: 0.8 }),
        lose: new Howl({ src: src('lose'), volume: 0.5 }),
        chip: new Howl({ src: src('chip'), volume: 0.4 }),
      };
      this.ready = true;
    },

    play(name) {
      if (this.sounds[name]) this.sounds[name].play();
    },

    stopAll() {
      Object.values(this.sounds).forEach((s) => s.stop());
    },

    setMuted(muted) {
      if (typeof Howler !== 'undefined') Howler.mute(!!muted);
      if (muted) this.stopAll();
    },
  };

  global.SoundManager = SoundManager;
})(window);
