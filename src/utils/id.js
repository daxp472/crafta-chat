'use strict';

let seed = 0;

function createId(prefix) {
  seed += 1;
  return `${prefix || 'id'}_${Date.now().toString(36)}_${seed.toString(36)}`;
}

module.exports = {
  createId,
};
