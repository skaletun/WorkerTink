import assert from 'node:assert/strict';
import {DEFAULT} from '../src/core.ts';
import {normalizeState} from '../src/storage.ts';

const legacy={...DEFAULT,setupComplete:true,schemaVersion:3,scheduleType:'5/2',scheduleShift:'full',nightExtraPercent:undefined};
const normalized=normalizeState(legacy);
assert.equal(normalized.schemaVersion,4);
assert.equal(normalized.scheduleShift,'day');
assert.equal(normalized.nightExtraPercent,20);
assert.equal(normalized.scheduleType,'5/2');
assert.equal(normalized.setupComplete,true);
console.log('WorkerTink storage migration tests: OK');
