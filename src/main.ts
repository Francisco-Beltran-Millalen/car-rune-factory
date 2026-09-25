import './styles.css';
import { createRouter } from './core/router.ts';
import { createShell } from './core/shell.ts';
import { modules } from './modules/registry.ts';

const app = document.getElementById('app');
if (!app) throw new Error('invariante: falta #app en index.html');

const router = createRouter((route) => {
  shell.route(route);
});
const shell = createShell(app, modules, router);
router.start();
