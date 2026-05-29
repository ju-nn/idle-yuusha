import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { runSelfTests } from './game/selfTests';
import { applyUserSettings, loadUserSettings } from './game/settings';
import './styles.css';

applyUserSettings(loadUserSettings());
runSelfTests();
createRoot(document.getElementById('root')!).render(<App />);
