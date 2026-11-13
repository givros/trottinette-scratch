import { isScooterPowered } from './scooter-blocks.js';

const specialKeys = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter']);
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
  const powerReading = document.querySelector('#power-reading');
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
    const x = Number.isFinite(rawPosition) ? rawPosition : -175;
    const speed = stage?.variables.speed?.value ?? 0;
    const powered = isScooterPowered(vm);
    const light = powered && Number(stage?.variables.light?.value) === 1;
    const elapsed = Math.min(now - previousTime, 50);
    previousTime = now;
    if (position === null || Math.abs(x - position) > 240) position = x;
    const delta = (x - position) * (1 - Math.exp(-elapsed / 48));
    position += delta;
    distance += delta * travel / scale;

    ctx.fillStyle = '#242b24';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const screenX = 600 + position * travel;
    const cameraX = screenX - Math.max(294, Math.min(490, screenX));
    if (track.naturalWidth) {
      const width = canvas.width;
      // Alternating mirrored tiles join at identical edges in both directions.
      const tile = Math.floor(cameraX / width);
      const left = tile * width - cameraX;
      for (let index = 0; index < 2; index++) {
        const xOffset = left + index * width;
        const flipped = (tile + index) % 2 !== 0;
        ctx.save();
        ctx.translate(xOffset + (flipped ? width : 0), 0);
        ctx.scale(flipped ? -1 : 1, 1);
        ctx.drawImage(track, 0, 0, width, canvas.height);
        ctx.restore();
      }
    }
    const offset = screenX - cameraX - 300 * scale;
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

    powerReading.value = powered ? 'Trottinette allumée' : 'Trottinette éteinte';
    powerReading.classList.toggle('is-powered', powered);
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
    if (!panel.open || event.isComposing) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (key.length !== 1 && !specialKeys.has(key)) return;
    const down = event.type === 'keydown';
    // Keep native keyboard activation on the simulator buttons.
    if (down && (key === ' ' || key === 'Enter') && event.target.closest('button')) return;
    if (down && (event.metaKey || event.ctrlKey || event.altKey)) return;
    event.preventDefault();
    event.stopPropagation();
    if (down && (startedAt === null || held.has(key))) return;
    if (down) held.add(key);
    else held.delete(key);
    vm.postIOData('keyboard', { key, isDown: down });
  }

  document.addEventListener('keydown', forward, true);
  document.addEventListener('keyup', forward, true);
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
  const runButton = document.querySelector('#run-project');
  const runStatus = document.querySelector('#run-status');
  function setRunning(running) {
    runButton.disabled = running;
    runButton.textContent = running ? 'Simulation en cours' : 'Démarrer';
    runStatus.textContent = running ? 'Simulation démarrée.' : 'Simulation arrêtée.';
  }

  runButton.addEventListener('click', () => {
    releaseKeys();
    position = null;
    distance = 0;
    startedAt = performance.now();
    vm.greenFlag();
    setRunning(true);
    canvas.focus();
  });
  function stopProject() {
    releaseKeys();
    startedAt = null;
    vm.stopAll();
    setRunning(false);
    position = null;
    canvas.focus();
  }

  document.querySelector('#stop-project').addEventListener('click', stopProject);
  document.querySelector('#reset-project').addEventListener('click', () => {
    stopProject();
    const stage = vm.runtime.getTargetForStage();
    if (stage?.variables.position) stage.variables.position.value = -175;
    if (stage?.variables.light) stage.variables.light.value = 0;
    distance = 0;
  });
  opener.disabled = false;
}
