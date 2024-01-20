import { Game, WEBGL, Scale, Types } from 'phaser';

import { Loader, Menu, Lobby, World, Sailing } from './scenes';

const config: Types.Core.GameConfig = {
  type: WEBGL,
  parent: 'gamewrapper',
  width: 240, //(320+80)*gameScale,
  height: 160, //(240+80)*gameScale,
  scale: {
    zoom: Scale.MAX_ZOOM,
  },
  render: {
    pixelArt: true,
  },
  title: 'pirate proto',
  physics: {
    default: 'arcade',
    arcade: {
      fps: 60,
      // debug: true,
    },
  },
  seed: ['test'],
  //transparent: true,
  scene: [Loader, Menu, Lobby, World, Sailing],
  //scene: [Loader, Menu, World, Map]\
};

window.addEventListener(
  'resize',
  function (event) {
    game.scale.setMaxZoom();
  },
  false
);

export const game = new Game(config);
