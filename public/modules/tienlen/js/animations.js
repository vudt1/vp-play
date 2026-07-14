(function (global) {
  const Animations = {
    async dealCards(cards, positions, origin) {
      const ox = origin?.x ?? 960;
      const oy = origin?.y ?? 420;
      for (let i = 0; i < cards.length; i += 1) {
        const card = cards[i];
        const pos = positions[i];
        card.x = ox;
        card.y = oy;
        card.container.alpha = 0;
        card.container.scale.set(0.45);
        await new Promise((resolve) => {
          gsap.to(card.container, {
            x: pos.x,
            y: pos.y,
            alpha: 1,
            duration: 0.32,
            delay: 0.04,
            ease: 'back.out(1.5)',
            onStart: () => {
              if (global.SoundManager) global.SoundManager.play('deal');
            },
            onComplete: resolve,
          });
          gsap.to(card.container.scale, {
            x: 1,
            y: 1,
            duration: 0.32,
            delay: 0.04,
            ease: 'back.out(1.5)',
          });
        });
        card.baseY = pos.y;
      }
    },

    playToTable(cards, center) {
      return Promise.all(
        cards.map((card, i) => {
          const spread = (i - (cards.length - 1) / 2) * 36;
          return new Promise((resolve) => {
            if (global.SoundManager) global.SoundManager.play('chip');
            gsap.to(card.container, {
              x: center.x + spread,
              y: center.y,
              duration: 0.35,
              ease: 'power2.out',
              onComplete: resolve,
            });
            gsap.to(card.container.scale, {
              x: 0.92,
              y: 0.92,
              duration: 0.35,
            });
          });
        })
      );
    },

    celebrateWin(stage, x, y, opts = {}) {
      const playSound = opts.playSound !== false;
      if (playSound && global.SoundManager) global.SoundManager.play('win');
      for (let i = 0; i < 28; i += 1) {
        const particle = new PIXI.Graphics();
        const colors = [0xff6b6b, 0xffd93d, 0x6bcb77, 0x4d96ff, 0xff6bff];
        const color = colors[i % colors.length];
        particle.circle(0, 0, Math.random() * 6 + 2);
        particle.fill(color);
        particle.x = x;
        particle.y = y;
        stage.addChild(particle);
        const angle = (Math.PI * 2 * i) / 28;
        const distance = Math.random() * 220 + 80;
        gsap.to(particle, {
          x: x + Math.cos(angle) * distance,
          y: y + Math.sin(angle) * distance,
          alpha: 0,
          duration: 0.9 + Math.random() * 0.4,
          ease: 'power2.out',
          onComplete: () => {
            stage.removeChild(particle);
            particle.destroy();
          },
        });
      }
    },

    showBanner(stage, text, color) {
      if (text === 'lose' || color === 0xff4444) {
        if (global.SoundManager) global.SoundManager.play('lose');
      }
      const label = new PIXI.Text({
        text,
        style: {
          fontFamily: 'Segoe UI, system-ui, sans-serif',
          fontSize: 48,
          fill: color || 0xe7ecf3,
          fontWeight: '700',
        },
      });
      label.anchor.set(0.5);
      label.x = 960;
      label.y = 200;
      label.alpha = 0;
      label.scale.set(0.6);
      stage.addChild(label);
      gsap.to(label, { alpha: 1, duration: 0.35 });
      gsap.to(label.scale, {
        x: 1,
        y: 1,
        duration: 0.4,
        ease: 'back.out(1.6)',
      });
      return label;
    },
  };

  global.Animations = Animations;
})(window);
