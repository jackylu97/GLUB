import '@fontsource/chango/400.css';
import '@fontsource/grandstander/500.css';
import '@fontsource/grandstander/500-italic.css';
import '@fontsource/grandstander/700.css';
import '@fontsource/grandstander/800.css';
import '@fontsource/big-shoulders-display/700';
import '@fontsource/big-shoulders-display/900';
import './styles/tokens.css';
import './styles/global.css';
import { mount } from 'svelte';
import App from './App.svelte';

mount(App, { target: document.getElementById('app')! });
