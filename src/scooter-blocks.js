const extensionId = 'scooter';

export function registerScooterBlocks(vm) {
  const manager = vm.extensionManager;
  if (manager.isExtensionLoaded(extensionId)) return;

  const variable = id => vm.runtime.getTargetForStage()?.variables[id];
  let driveTimer;
  let lastDriveTick;
  const stopDriving = () => {
    clearInterval(driveTimer);
    driveTimer = undefined;
  };
  const drive = () => {
    const now = performance.now();
    const elapsed = Math.min((now - lastDriveTick) / 1000, .1);
    lastDriveTick = now;
    const speed = Number(variable('speed')?.value);
    const position = variable('position');
    if (!position || !(speed > 0)) {
      stopDriving();
      return;
    }
    const next = (Number(position.value) || 0) + speed * 3.2 * elapsed;
    position.value = next > 170 ? -175 + (next - 170) % 345 : next;
  };
  const changeSpeed = delta => {
    const speed = variable('speed');
    if (!speed) return;
    speed.value = Math.max(0, Math.min(25, (Number(speed.value) || 0) + delta));
    if (speed.value === 0) {
      stopDriving();
    } else if (driveTimer === undefined) {
      lastDriveTick = performance.now();
      driveTimer = setInterval(drive, 25);
    }
  };
  vm.on('PROJECT_STOP_ALL', stopDriving);
  const setLight = value => {
    const light = variable('light');
    if (light) light.value = value;
  };
  const extension = {
    getInfo() {
      return {
        id: extensionId,
        name: 'Trottinette',
        color1: '#4c97ff',
        color2: '#4280d7',
        color3: '#3373cc',
        blocks: [
          {
            opcode: 'move',
            blockType: 'command',
            text: 'avancer de [STEPS] pas',
            arguments: { STEPS: { type: 'number', defaultValue: 10 } }
          },
          {
            opcode: 'goTo',
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
    move({ STEPS }) {
      const current = variable('position');
      if (current) this.goTo({ POSITION: (Number(current.value) || 0) + (Number(STEPS) || 0) });
    },
    goTo({ POSITION }) {
      const current = variable('position');
      if (current) current.value = Math.max(-250, Math.min(250, Number(POSITION) || 0));
    },
    accelerate({ AMOUNT }) {
      changeSpeed(Math.max(0, Number(AMOUNT) || 0));
    },
    brake({ AMOUNT }) {
      changeSpeed(-Math.max(0, Number(AMOUNT) || 0));
    },
    lightOn() {
      setLight(1);
    },
    lightOff() {
      setLight(0);
    }
  };

  // Register as an in-process extension before loading any saved project.
  const service = manager._registerInternalExtension(extension);
  manager._loadedExtensions.set(extensionId, service);
}
