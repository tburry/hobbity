import '../../src/styles/tokens.scss';
import '../../src/components/map/map-viewer.scss';
import { mount } from 'svelte';
import App from './App.svelte';

mount(App, { target: document.getElementById('app') });
