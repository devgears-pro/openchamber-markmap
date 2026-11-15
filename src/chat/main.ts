import { connectHost } from '@openchamber/sdk';

import { createMarkmapPreview } from '../markmap/preview';
import { mountChatBlock } from './block';

const root = document.querySelector<HTMLElement>('#root');
if (root === null) throw new Error('Markmap: missing #root');

mountChatBlock(connectHost(), root, { createPreview: createMarkmapPreview });
