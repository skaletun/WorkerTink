const fs=require('fs');
const assert=require('assert');
const path=require('path');
const root=path.join(__dirname,'..');
const api=fs.readFileSync(path.join(root,'directory-api/src/index.js'),'utf8');
const legacy=fs.readFileSync(path.join(root,'server/index.mjs'),'utf8');

assert.match(api,/access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS'/);
assert.doesNotMatch(api,/console\.error\(['"]INVALID_JSON_BODY/);
assert.match(api,/async function body\(request\) \{[\s\S]*?return JSON\.parse\(await request\.text\(\)\);[\s\S]*?catch/);
assert.match(legacy,/Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS'/);

console.log('WorkerTink API regression tests: OK');
