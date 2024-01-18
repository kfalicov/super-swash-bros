import { Scene } from "phaser";

class Sailing extends Scene {
  constructor() {
    super("Sailing");
  }
  preload() {}
  create() {
    this.cameras.main.setBackgroundColor("#C28E5B");
    // this.cameras.main.setBounds(0, 0, 64, 64);
    this.cameras.main.setPosition(0, 0);
    this.cameras.main.setSize(64, 64);

    let hull = this.add.image(32, 33.5, "tiny_ship", 0).setOrigin(3.5 / 6, 0.5);
    let deck = this.add.image(32, 32, "tiny_ship", 1).setOrigin(3.5 / 6, 0.5);

    this.tweens.add({
      targets: [hull, deck],
      duration: 4000,
      props: {
        angle: {
          from: 0,
          to: 360,
        },
      },
      repeat: -1,
    });
  }
}

export default Sailing;
