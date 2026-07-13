(function (global) {
  const CARD_W = 110;
  const CARD_H = 154;

  class Card {
    constructor(cardId, backTexture, frontTexture) {
      this.cardId = cardId;
      this.isFaceUp = false;
      this.selected = false;
      this.baseY = 0;
      this.interactiveEnabled = false;

      this.container = new PIXI.Container();
      this.backSprite = new PIXI.Sprite(backTexture);
      this.frontSprite = new PIXI.Sprite(frontTexture);
      this.backSprite.anchor.set(0.5);
      this.frontSprite.anchor.set(0.5);
      this.backSprite.width = CARD_W;
      this.backSprite.height = CARD_H;
      this.frontSprite.width = CARD_W;
      this.frontSprite.height = CARD_H;
      this.frontSprite.visible = false;

      this.container.addChild(this.backSprite);
      this.container.addChild(this.frontSprite);
      this.container.eventMode = 'none';
      this.container.cursor = 'pointer';
    }

    get x() {
      return this.container.x;
    }
    set x(v) {
      this.container.x = v;
    }
    get y() {
      return this.container.y;
    }
    set y(v) {
      this.container.y = v;
    }

    setFaceUp(faceUp, animate) {
      if (this.isFaceUp === faceUp) return Promise.resolve();
      if (!animate) {
        this.isFaceUp = faceUp;
        this.backSprite.visible = !faceUp;
        this.frontSprite.visible = faceUp;
        return Promise.resolve();
      }
      return this.flip();
    }

    flip() {
      return new Promise((resolve) => {
        if (global.SoundManager) global.SoundManager.play('flip');
        gsap.to(this.container.scale, {
          x: 0,
          duration: 0.12,
          ease: 'power2.in',
          onComplete: () => {
            this.isFaceUp = !this.isFaceUp;
            this.backSprite.visible = !this.isFaceUp;
            this.frontSprite.visible = this.isFaceUp;
            gsap.to(this.container.scale, {
              x: 1,
              duration: 0.12,
              ease: 'power2.out',
              onComplete: resolve,
            });
          },
        });
      });
    }

    moveTo(x, y, duration) {
      return new Promise((resolve) => {
        gsap.to(this.container, {
          x,
          y,
          duration: duration ?? 0.4,
          ease: 'power3.out',
          onComplete: resolve,
        });
      });
    }

    setSelected(selected) {
      this.selected = selected;
      const targetY = this.baseY + (selected ? -28 : 0);
      gsap.to(this.container, { y: targetY, duration: 0.15, ease: 'power2.out' });
    }

    setInteractive(on, onTap) {
      this.interactiveEnabled = on;
      this.container.eventMode = on ? 'static' : 'none';
      this.container.removeAllListeners();
      if (on && onTap) {
        this.container.on('pointertap', () => onTap(this));
      }
    }

    destroy() {
      gsap.killTweensOf(this.container);
      gsap.killTweensOf(this.container.scale);
      this.container.destroy({ children: true });
    }
  }

  Card.WIDTH = CARD_W;
  Card.HEIGHT = CARD_H;
  global.Card = Card;
})(window);
