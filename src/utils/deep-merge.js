'use strict';

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge(target, source) {
  if (!isObject(target) || !isObject(source)) {
    return source;
  }

  const out = { ...target };
  for (const key of Object.keys(source)) {
    const sourceValue = source[key];
    const targetValue = target[key];

    if (isObject(sourceValue) && isObject(targetValue)) {
      out[key] = deepMerge(targetValue, sourceValue);
      continue;
    }

    if (sourceValue !== undefined) {
      out[key] = sourceValue;
    }
  }

  return out;
}

module.exports = {
  deepMerge,
  isObject,
};
