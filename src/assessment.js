const duration = 20 * 60 * 1000;
const storageKey = 'scooter-assessment';

export function prepareAssessment() {
  const entry = document.createElement('section');
  entry.className = 'assessment-entry';
  entry.innerHTML = '<h2>Évaluation · Programmer la trottinette</h2><p>Tu disposes de 20 minutes à partir du lancement de l’évaluation.</p><form><label>Nom <input name="surname" required maxlength="80" autocomplete="family-name"></label><label>Prénom <input name="firstname" required maxlength="80" autocomplete="given-name"></label><button>Commencer les 20 minutes</button></form>';
  document.querySelector('#scratch-editor').before(entry);
  document.querySelector('#scratch-editor').hidden = true;
  document.querySelector('#open-simulator').hidden = true;
  let session;
  try { session = JSON.parse(sessionStorage.getItem(storageKey)); } catch { session = null; }
  return new Promise(resolve => {
    function launch() {
      entry.remove();
      document.querySelector('#scratch-editor').hidden = false;
      document.querySelector('#open-simulator').hidden = false;
      resolve(session);
    }
    if (session?.deadline && session?.surname && session?.firstname) {
      launch();
      return;
    }
    entry.querySelector('form').addEventListener('submit', event => {
      event.preventDefault();
      const data = new FormData(event.target);
      const surname = data.get('surname').trim();
      const firstname = data.get('firstname').trim();
      if (!surname || !firstname) return;
      session = { surname, firstname, deadline: Date.now() + duration };
      sessionStorage.setItem(storageKey, JSON.stringify(session));
      launch();
    });
  });
}

export function connectAssessment(vm, session) {
  const bar = document.createElement('div');
  bar.className = 'assessment-bar';
  const identity = document.createElement('strong');
  identity.textContent = session.firstname + ' ' + session.surname;
  const timer = document.createElement('output');
  timer.setAttribute('aria-label', 'Temps restant');
  const submit = document.createElement('button');
  submit.textContent = 'Terminer et télécharger mon travail';
  bar.append(identity, timer, submit);
  document.querySelector('.toolbar').after(bar);
  let ready = false;
  let locked = false;
  let snapshot;
  let saving = false;
  let lastSave = 0;
  const projectKey = storageKey + '-project';
  function remember() {
    if (locked || saving || Date.now() < lastSave + 5000) return;
    saving = true;
    vm.saveProjectSb3().then(blob => {
      const reader = new FileReader();
      reader.onload = () => {
        try { sessionStorage.setItem(projectKey, reader.result); } catch { /* Download remains available. */ }
      };
      reader.readAsDataURL(blob);
      lastSave = Date.now();
    }).finally(() => { saving = false; });
  }
  function lock() {
    if (locked) return;
    locked = true;
    session.deadline = Math.min(session.deadline, Date.now());
    sessionStorage.setItem(storageKey, JSON.stringify(session));
    vm.stopAll();
    document.querySelector('#simulator').close();
    const editor = document.querySelector('#scratch-editor');
    editor.inert = true;
    document.querySelector('#open-simulator').disabled = true;
    snapshot = vm.saveProjectSb3();
    timer.textContent = 'Évaluation terminée';
    submit.textContent = 'Télécharger mon travail';
  }
  async function download() {
    lock();
    const blob = await snapshot;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safe = value => value.replace(/[^\p{L}\p{N}_-]/gu, '_');
    link.href = url;
    link.download = 'Trottinette_' + safe(session.surname) + '_' + safe(session.firstname) + '.sb3';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  submit.addEventListener('click', download);
  async function restore() {
    const cached = sessionStorage.getItem(projectKey);
    if (cached) {
      const data = await fetch(cached).then(response => response.arrayBuffer());
      await vm.loadProject(data);
    }
    ready = true;
    tick();
  }
  function tick() {
    if (locked || !ready) return;
    const remaining = session.deadline - Date.now();
    if (remaining <= 0) { lock(); return; }
    const seconds = Math.ceil(remaining / 1000);
    timer.textContent = Math.floor(seconds / 60).toString().padStart(2, '0') + ':' + (seconds % 60).toString().padStart(2, '0');
    bar.classList.toggle('time-warning', remaining <= 60000);
    remember();
  }
  vm.runtime.on('PROJECT_LOADED', function loaded() {
    vm.runtime.removeListener('PROJECT_LOADED', loaded);
    restore();
  });
  setInterval(tick, 250);
}
