import { cp } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const scratch = dirname(require.resolve('@scratch/scratch-gui'));
for (const entry of ['scratch-gui.js', 'scratch-gui.js.LICENSE.txt', 'chunks', 'static', 'libraries', 'extension-worker.js', 'extension-worker.js.LICENSE.txt']) {
  await cp(join(scratch, entry), join('dist', entry), {
    recursive: true,
    filter: path => !path.endsWith('.map')
  });
}
