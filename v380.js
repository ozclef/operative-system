import WSPlayer from 'jsmpeg-player';
const player = new WSPlayer({
  url: 'ws://TU_SERVIDOR:9999/',
  canvas: document.getElementById('camCanvas')
});
player.play();
