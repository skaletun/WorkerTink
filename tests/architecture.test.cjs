const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const size = (name) => Buffer.byteLength(read(name), 'utf8');
const assertBelow = (name, maximum) => {
  const actual = size(name);
  if (actual > maximum) throw new Error(`${name} grew to ${actual} bytes; maximum is ${maximum}`);
};

for (const [name, limit] of [
  ['src/App.tsx', 35000],
  ['src/core.ts', 1000],
  ['src/directory.ts', 1500],
  ['src/ui.css', 1000],
  ['src/domain/payroll.ts', 16000],
  ['src/views/auth/AuthViews.tsx', 30000],
  ['src/views/network/NetworkParts.tsx', 22000],
  ['src/views/chat/ChatParts.tsx', 14000],
  ['src/views/chat/ChatTypes.ts', 1000],
  ['src/views/channels/channelUtils.ts', 2000],
]) assertBelow(name, limit);

const app = read('src/App.tsx');
for (const modulePath of [
  './views/auth/AuthViews',
  './views/profile/ProfileViews',
  './views/admin/AdminView',
  './views/people/PeopleViews',
  './views/work/WorkViews',
  './views/work/ShiftEditor',
  './views/settings/SettingsView',
  './app/reminders',
]) {
  if (!app.includes(modulePath)) throw new Error(`App route orchestrator is missing module: ${modulePath}`);
}
if (!read('src/NetworkView.tsx').includes('./views/network/NetworkParts')) throw new Error('NetworkView is missing its feature module');
if (!read('src/ChatView.tsx').includes('./views/chat/ChatParts.tsx') || !read('src/ChatView.tsx').includes('./views/chat/ChatTypes.ts')) throw new Error('ChatView is missing chat submodules');

const sourceDirs = [
  'src/domain',
  'src/views/auth',
  'src/views/profile',
  'src/views/admin',
  'src/views/people',
  'src/views/work',
  'src/views/settings',
  'src/views/network',
  'src/views/chat',
  'src/views/channels',
  'src/directory',
  'src/styles',
];
for (const dir of sourceDirs) {
  if (!fs.existsSync(path.join(root, dir))) throw new Error(`Missing modular source directory: ${dir}`);
}

const cssEntry = read('src/ui.css');
const cssImports = [...cssEntry.matchAll(/@import\s+['"](.+?)['"]\s*;/g)].map((match) => match[1]);
if (cssImports.length < 12) throw new Error('Styles entrypoint must explicitly assemble the page and component styles');
for (const imported of cssImports) {
  const localPath = path.resolve(root, 'src', imported);
  if (!fs.existsSync(localPath)) throw new Error(`Missing imported stylesheet: ${imported}`);
  if (Buffer.byteLength(fs.readFileSync(localPath), 'utf8') > 16000) {
    throw new Error(`Stylesheet module is too large and should be split by responsibility: ${imported}`);
  }
}

const apiEntry = read('src/directory.ts');
for (const domain of ['identity', 'admin', 'friends', 'calls', 'push', 'social', 'chat', 'groups', 'channels', 'network', 'work']) {
  if (!apiEntry.includes(`./directory/${domain}`)) throw new Error(`Directory API barrel is missing ${domain} domain`);
  assertBelow(`src/directory/${domain}.ts`, 8000);
}
for (const domain of ['types', 'foundation', 'schedule', 'payroll']) {
  if (!fs.existsSync(path.join(root, `src/domain/${domain}.ts`))) throw new Error(`Missing calculation domain module: ${domain}`);
}

if (!read('src/core.ts').includes("./domain/payroll")) throw new Error('Core compatibility facade must export payroll calculations');
console.log('WTinker modular architecture checks: OK');
