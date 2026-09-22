import './styles.css';
import { modules } from './modules/registry.js';
import { createRouter } from './core/router.js';
import { createShell } from './core/shell.js';

const router = createRouter((id) => shell.route(id));
const shell = createShell(document.getElementById('app'), modules, router);
router.start();
