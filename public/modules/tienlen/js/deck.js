(function (global) {
  class Deck {
    constructor(stage, backTexture) {
      this.stage = stage;
      this.backTexture = backTexture;
      this.pile = new PIXI.Container();
      this.stage.addChild(this.pile);
      this.pile.x = 960;
      this.pile.y = 420;
    }

    showStock(count) {
      this.clear();
      const n = Math.min(count, 8);
      for (let i = 0; i < n; i += 1) {
        const s = new PIXI.Sprite(this.backTexture);
        s.anchor.set(0.5);
        s.width = Card.WIDTH * 0.85;
        s.height = Card.HEIGHT * 0.85;
        s.x = i * 1.5;
        s.y = -i * 1.5;
        this.pile.addChild(s);
      }
      this.pile.visible = n > 0;
    }

    clear() {
      this.pile.removeChildren().forEach((c) => c.destroy());
    }

    createCard(cardId, frontTexture) {
      return new Card(cardId, this.backTexture, frontTexture);
    }
  }

  global.Deck = Deck;
})(window);
