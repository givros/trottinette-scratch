const keys = new Set([' ', 'ArrowUp', 'ArrowDown', 'l']);
const load = name => {
  const image = new Image();
  image.src = import.meta.env.BASE_URL + 'simulator/' + name;
  return image;
};

export function connectSimulator(vm) {
  const panel = document.querySelector('#simulator');
  const opener = document.querySelector('#open-simulator');
  const canvas = document.querySelector('#test-track');
  const ctx = canvas.getContext('2d');
  const track = load('winter.jpg');
  const scooter = load('winter-scooter.png');
  const wheels = [
    { image: load('winter-rear.png'), x: 97, y: 346, radius: 43 },
    { image: load('winter-front.png'), x: 498, y: 345, radius: 39 }
  ];
  const speedReading = document.querySelector('#speed-reading');
  const lightReading = document.querySelector('#light-reading');
  const positionReading = document.querySelector('#position-reading');
  const held = new Set();
  let frame = 0;
  let position = null;
  let distance = 0;
  let previousTime = 0;
  let startedAt = null;
  const scale = .30;
  const travel = 1.75;

  function draw(now) {
    const stage = vm.runtime.getTargetForStage();
    const rawPosition = Number(stage?.variables.position?.value ?? -175);
    const x = Number.isFinite(rawPosition) ? Math.max(-250, Math.min(250, rawPosition)) : -175;
    const speed = stage?.variables.speed?.value ?? 0;
    const light = Number(stage?.variables.light?.value) === 1;
    const elapsed = Math.min(now - previousTime, 50);
    previousTime = now;
    if (position === null || Math.abs(x - position) > 240) position = x;
    const delta = (x - position) * (1 - Math.exp(-elapsed / 48));
    position += delta;
    distance += delta * travel / scale;

    ctx.fillStyle = '#242b24';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (track.naturalWidth) ctx.drawImage(track, 0, 0, 1200, 560);
    const offset = 600 + position * travel - 300 * scale;
    ctx.save();
    ctx.translate(offset, 387 - 401 * scale);
    ctx.scale(scale, scale);

    if (light) {
      const beam = ctx.createLinearGradient(452, 0, 900, 0);
      beam.addColorStop(0, '#fff5b8dd');
      beam.addColorStop(1, '#fff5b800');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(452, 23);
      ctx.lineTo(900, 6);
      ctx.lineTo(900, 64);
      ctx.closePath();
      ctx.fill();
    }
    if (scooter.naturalWidth) ctx.drawImage(scooter, 0, 0);
    for (const wheel of wheels) {
      if (!wheel.image.naturalWidth) continue;
      ctx.save();
      ctx.translate(wheel.x, wheel.y);
      ctx.rotate(distance / wheel.radius);
      ctx.drawImage(wheel.image, -wheel.radius, -wheel.radius);
      ctx.restore();
    }
    if (scooter.naturalWidth) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(450, 296);
      ctx.lineTo(483, 294);
      ctx.lineTo(508, 339);
      ctx.lineTo(500, 355);
      ctx.lineTo(484, 355);
      ctx.lineTo(469, 330);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(scooter, 0, 0);
      ctx.restore();
    }
    ctx.restore();
    ctx.fillStyle = '#1258b7';
    ctx.font = '900 34px Arial Black, Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(String(speed).padStart(2, '0') + ' KM/H', 44, 49);
    ctx.textAlign = 'center';
    const seconds = startedAt === null ? 0 : (now - startedAt) / 1000;
    const elapsedText = String(Math.floor(seconds / 60)).padStart(2, '0') + ':' +
      (seconds % 60).toFixed(1).padStart(4, '0');
    ctx.fillText(elapsedText, 600, 49);

    speedReading.value = speed + ' km/h';
    lightReading.value = light ? 'Phare allumé' : 'Phare éteint';
    positionReading.value = 'Position x ' + Math.round(x);
    frame = requestAnimationFrame(draw);
  }

  function releaseKeys() {
    for (const key of held) vm.postIOData('keyboard', { key, isDown: false });
    held.clear();
  }

  function forward(event) {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (!keys.has(key) || (key === ' ' && event.target !== canvas)) return;
    event.preventDefault();
    event.stopPropagation();
    const down = event.type === 'keydown';
    if (down && held.has(key)) return;
    if (down) held.add(key);
    else held.delete(key);
    vm.postIOData('keyboard', { key, isDown: down });
  }

  panel.addEventListener('keydown', forward);
  panel.addEventListener('keyup', forward);
  window.addEventListener('blur', releaseKeys);
  opener.addEventListener('click', () => {
    panel.showModal();
    canvas.focus();
    position = null;
    distance = 0;
    previousTime = performance.now();
    frame = requestAnimationFrame(draw);
  });
  panel.addEventListener('close', () => {
    releaseKeys();
    cancelAnimationFrame(frame);
  });
  document.querySelector('#close-simulator').addEventListener('click', () => panel.close());
  document.querySelector('#run-project').addEventListener('click', () => {
    releaseKeys();
    position = null;
    distance = 0;
    startedAt = performance.now();
    vm.greenFlag();
    canvas.focus();
  });
  document.querySelector('#stop-project').addEventListener('click', () => {
    releaseKeys();
    startedAt = null;
    vm.stopAll();
    position = null;
    canvas.focus();
  });
  opener.disabled = false;
}
