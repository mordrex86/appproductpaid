import { cpSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const source = require('swagger-ui-dist/absolute-path.js')();
const target = resolve(
  '.aws-sam/build/ApiFunction/node_modules/swagger-ui-dist',
);

mkdirSync(dirname(target), { recursive: true });
cpSync(source, target, { recursive: true });
