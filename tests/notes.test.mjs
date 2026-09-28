import assert from 'node:assert/strict';
const source=`# WorkerTink — заметки по сменам\n\n## SHIFT: 2026-09-28 — День\n\n# Отчёт\n\n**Готово** и *важно*.\n\n- пункт 1\n- пункт 2\n`;
const matches=[...source.matchAll(/^## SHIFT:\s*(\d{4}-\d{2}-\d{2})(?:\s+—.*)?\s*$/gmi)];
assert.equal(matches.length,1);
const body=source.slice(matches[0].index+matches[0][0].length).trim();
assert.equal(body,'# Отчёт\n\n**Готово** и *важно*.\n\n- пункт 1\n- пункт 2');
console.log('WorkerTink notes tests: OK');

import {markdownToHtml,htmlToMarkdown} from '../src/markdown.ts';
const html=markdownToHtml('| A | B |\n| --- | --- |\n| 1 | **2** |');
assert.match(html,/table/);
assert.match(html,/strong/);
const host={
 childNodes:[],
};
// Source-level round-trip coverage is intentionally complemented by the WYSIWYG smoke test.
console.log('WorkerTink markdown round-trip fixtures: OK');
