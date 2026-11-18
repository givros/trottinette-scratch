const extensionId = 'scooter';
const trackUnitsPerMeter = 28.8;
const poweredStages = new WeakSet();
const motionStops = new WeakMap();

export function stopScooterMotion(vm) {
  motionStops.get(vm)?.();
}

export function isScooterPowered(vm) {
  return poweredStages.has(vm.runtime.getTargetForStage());
}

export function registerScooterBlocks(vm) {
  const manager = vm.extensionManager;
  if (manager.isExtensionLoaded(extensionId)) return;

  function hasPowerCondition(util) {
    const blocks = util?.target?.blocks;
    let current = blocks?.getBlock(util.thread?.peekStack());
    while (current?.parent) {
      const parent = blocks.getBlock(current.parent);
      if (!parent) return false;
      const condition = blocks.getBlock(parent.inputs?.CONDITION?.block);
      const insideTrueBranch = parent.inputs?.SUBSTACK?.block === current.id;
      if ((parent.opcode === 'control_if' || parent.opcode === 'control_if_else') &&
          insideTrueBranch && condition?.opcode === 'scooter_isPowered') return true;
      current = parent;
    }
    return false;
  }

  const variable = id => vm.runtime.getTargetForStage()?.variables[id];
  let driveTimer;
  let lastDriveTick;
  let lastAcceleration = -Infinity;
  const stopDriving = () => {
    clearInterval(driveTimer);
    driveTimer = undefined;
    lastAcceleration = -Infinity;
    const speed = variable('speed');
    if (speed) speed.value = 0;
  };
  motionStops.set(vm, stopDriving);
  const drive = () => {
    const now = performance.now();
    const elapsed = Math.min((now - lastDriveTick) / 1000, .1);
    lastDriveTick = now;
    const speedVariable = variable('speed');
    let speed = Number(speedVariable?.value);
    if (!vm.runtime.ioDevices.keyboard.getKeyIsDown('up arrow') ||
        now - lastAcceleration > 150) {
      stopDriving();
      return;
    }
    const position = variable('position');
    if (!isScooterPowered(vm) || !position || !(speed > 0)) {
      stopDriving();
      return;
    }
    position.value = (Number(position.value) || 0) + (speed / 3.6) * trackUnitsPerMeter * elapsed;
  };
  const changeSpeed = delta => {
    const speed = variable('speed');
    if (!speed || !isScooterPowered(vm)) return;
    speed.value = Math.max(0, Math.min(25, (Number(speed.value) || 0) + delta));
    if (speed.value === 0) {
      stopDriving();
    } else if (driveTimer === undefined) {
      lastDriveTick = performance.now();
      driveTimer = setInterval(drive, 25);
    }
  };
  const setLight = value => {
    const light = variable('light');
    if (light) light.value = value;
  };
  const powerOff = () => {
    const stage = vm.runtime.getTargetForStage();
    poweredStages.delete(stage);
    stopDriving();
    const speed = variable('speed');
    if (speed) speed.value = 0;
    setLight(0);
  };
  vm.runtime.on('PROJECT_STOP_ALL', powerOff);
  const extension = {
    getInfo() {
      return {
        id: extensionId,
        name: 'Trottinette',
        color1: '#4c97ff',
        color2: '#4280d7',
        color3: '#3373cc',
        blocks: [
          { opcode: 'powerOn', blockType: 'command', text: 'allumer la trottinette' },
          { opcode: 'powerOff', blockType: 'command', text: 'éteindre la trottinette' },
          { opcode: 'isPowered', blockType: 'Boolean', text: 'trottinette allumée ?' },
          {
            opcode: 'move',
            hideFromPalette: true,
            blockType: 'command',
            text: 'avancer de [STEPS] pas',
            arguments: { STEPS: { type: 'number', defaultValue: 10 } }
          },
          {
            opcode: 'goTo',
            hideFromPalette: true,
            blockType: 'command',
            text: 'aller à la position [POSITION]',
            arguments: { POSITION: { type: 'number', defaultValue: -175 } }
          },
          {
            opcode: 'accelerate',
            blockType: 'command',
            text: 'accélérer de [AMOUNT] km/h',
            arguments: { AMOUNT: { type: 'number', defaultValue: 5 } }
          },
          {
            opcode: 'brake',
            blockType: 'command',
            text: 'freiner de [AMOUNT] km/h',
            arguments: { AMOUNT: { type: 'number', defaultValue: 5 } }
          },
          { opcode: 'lightOn', blockType: 'command', text: 'allumer le phare' },
          { opcode: 'lightOff', blockType: 'command', text: 'éteindre le phare' }
        ]
      };
    },
    powerOn() {
      const stage = vm.runtime.getTargetForStage();
      if (stage && vm.runtime.ioDevices.keyboard.getKeyIsDown('a')) poweredStages.add(stage);
    },
    powerOff(args, util) {
      if (hasPowerCondition(util) && isScooterPowered(vm)) powerOff();
    },
    isPowered() {
      return isScooterPowered(vm);
    },
    move({ STEPS }) {
      if (!isScooterPowered(vm)) return;
      const current = variable('position');
      if (current) this.goTo({ POSITION: (Number(current.value) || 0) + (Number(STEPS) || 0) });
    },
    goTo({ POSITION }) {
      const current = variable('position');
      const next = Number(POSITION);
      if (current && Number.isFinite(next)) current.value = next;
    },
    accelerate({ AMOUNT }, util) {
      if (!hasPowerCondition(util)) return;
      if (!isScooterPowered(vm) ||
          !vm.runtime.ioDevices.keyboard.getKeyIsDown('up arrow')) return;
      const amount = Math.max(0, Number(AMOUNT) || 0);
      if (amount === 0) return;
      changeSpeed(amount);
      lastAcceleration = performance.now();
    },
    brake({ AMOUNT }, util) {
      if (!hasPowerCondition(util)) return;
      changeSpeed(-Math.max(0, Number(AMOUNT) || 0));
    },
    lightOn(args, util) {
      if (!hasPowerCondition(util)) return;
      if (isScooterPowered(vm)) setLight(1);
    },
    lightOff(args, util) {
      if (!hasPowerCondition(util)) return;
      setLight(0);
    }
  };

  // Register as an in-process extension before loading any saved project.
  const service = manager._registerInternalExtension(extension);
  manager._loadedExtensions.set(extensionId, service);
}
