import { Game, WEBGL, Scale } from "phaser";

import { Loader, World, Menu, Sailing } from "./scenes";

const config = {
  type: WEBGL,
  parent: "gamewrapper",
  width: 240, //(320+80)*gameScale,
  height: 160, //(240+80)*gameScale,
  scale: {
    zoom: Scale.MAX_ZOOM,
  },
  render: {
    pixelArt: true,
  },
  title: "pirate proto",
  physics: {
    default: "arcade",
    arcade: {
      fps: 60,
      debug: true,
    },
  },
  seed: ["test"],
  //transparent: true,
  scene: [Loader, Menu, World, Sailing],
  //scene: [Loader, Menu, World, Map]
  /**
   * whether to show debug hitboxes for inputs
   */
  debug: false,
};

window.addEventListener(
  "resize",
  function (event) {
    game.scale.setMaxZoom();
  },
  false
);

export const game = new Game(config);
