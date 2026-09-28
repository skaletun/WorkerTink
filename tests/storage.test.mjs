import assert from 'node:assert/strict';
import {DEFAULT} from '../src/core.ts';
import {normalizeState} from '../src/storage.ts';

const legacy={...DEFAULT,setupComplete:true,schemaVersion:3,scheduleType:'5/2',scheduleShift:'full',nightExtraPercent:undefined};
const normalized=normalizeState(legacy);
<<<<<<< HEAD
assert.equal(normalized.schemaVersion,6);
=======
assert.equal(normalized.schemaVersion,8);
>>>>>>> 5b4ad83 (feat: account auth with PIN and OnePass)
assert.equal(normalized.scheduleShift,'day');
assert.equal(normalized.nightExtraPercent,20);
assert.equal(normalized.scheduleType,'5/2');
assert.equal(normalized.setupComplete,true);
assert.equal(normalized.profile.name,'');
assert.deepEqual(normalized.friends,{});
assert.deepEqual(normalized.friendRequestsIncoming,[]);
assert.deepEqual(normalized.friendRequestsOutgoing,[]);
assert.match(normalized.profile.profileId,/^WTinkID-\d{6}$/);
assert.deepEqual(normalized.chats,{});
<<<<<<< HEAD
=======
assert.equal(normalized.notifications.enabled,true);
assert.equal(normalized.notifications.messages,true);
assert.equal(normalized.onePassEnabled,false);
>>>>>>> 5b4ad83 (feat: account auth with PIN and OnePass)
console.log('WorkerTink storage migration tests: OK');
