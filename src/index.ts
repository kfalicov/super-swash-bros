import { Game, WEBGL, Scale } from "phaser";

import { Loader, World, Menu } from "./scenes";

const config = {
  type: WEBGL,
  parent: "gamewrapper",
  width: 320, //(320+80)*gameScale,
  height: 240, //(240+80)*gameScale,
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
      // debug: true,
    },
  },
  seed: ["test"],
  //transparent: true,
  scene: [Loader, World],
  //scene: [Loader, Menu, World, Map]
};

window.addEventListener(
  "resize",
  function (event) {
    game.scale.setMaxZoom();
  },
  false
);

export const game = new Game(config);
