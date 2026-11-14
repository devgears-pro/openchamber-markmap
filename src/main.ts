import { connectHost } from '@openchamber/sdk';

import { mountApp } from './app';
import { createMarkmapView } from './markmap/view';

const root = document.querySelector<HTMLElement>('#root');
if (root === null) throw new Error('Markmap: missing #root');

mountApp(connectHost(), root, { createMarkmap: createMarkmapView });
