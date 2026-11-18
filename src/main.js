import React from 'react';
import * as ReactDOM from 'react-dom';
import { createRoot } from 'react-dom/client';
import * as ReactRedux from 'react-redux';
import * as Redux from 'redux';
import './style.css';
import { prepareAssessment, connectAssessment } from './assessment.js';
import { connectSimulator } from './simulator.js';
import { registerScooterBlocks } from './scooter-blocks.js';

const params = new URLSearchParams(location.search);
if (!params.has('locale')) {
  params.set('locale', 'fr');
  history.replaceState(history.state, '', '?' + params);
}
if (params.has('mode')) {
  params.delete('mode');
  history.replaceState(history.state, '', '?' + params);
}
const assessment = params.get('evaluation') === '1';
const assessmentSession = assessment ? await prepareAssessment() : null;
const filename = 'trottinette-depart.sb3';
const projectName = 'Trottinette M365 - Projet élève';
const editor = document.querySelector('#scratch-editor');


Object.assign(globalThis, {
  react: React,
  'react-dom': ReactDOM,
  'react-redux': ReactRedux,
  redux: Redux
});

const distribution = document.createElement('script');
distribution.src = import.meta.env.BASE_URL + 'scratch-gui.js';
distribution.onload = () => {
  const { AppStateHOC, default: ScratchEditor, setAppElement } = globalThis.GUI;
  const App = AppStateHOC(ScratchEditor);
  setAppElement(editor);
  createRoot(editor).render(React.createElement(App, {
    projectId: filename,
    projectHost: new URL(import.meta.env.BASE_URL + 'projects', location.origin).href,
    projectTitle: projectName,
    onVmInit: vm => {
      registerScooterBlocks(vm);
      connectSimulator(vm);
      if (assessmentSession) connectAssessment(vm, assessmentSession);
    },
    canEditTitle: true,
    canSave: false,
    backpackVisible: false,
    isTelemetryEnabled: false
  }));
};
distribution.onerror = () => {
  document.querySelector('#loading').textContent = 'L’éditeur Scratch n’a pas pu se charger. Recharge la page.';
};
document.head.append(distribution);
