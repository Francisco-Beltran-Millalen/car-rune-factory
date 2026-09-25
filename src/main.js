import './styles.css';
import { modules } from './modules/registry.js';
import { createRouter } from './core/router.ts';
import { createShell } from './core/shell.js';

const router = createRouter((route) => shell.route(route));
const shell = createShell(document.getElementById('app'), modules, router);
router.start();
