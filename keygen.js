// Format-only validation for 36-character keys (UUID-style).
// Actual key generation happens on the backend.
//
// Format: XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX (32 hex + 4 dashes = 36 chars)

const MAX_TEXT_CHARS = 200;
const KEY_LENGTH = 36;
const KEY_REGEX = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/;

function normalizeKey(raw) {
  return (raw || '').toString().trim().toUpperCase();
}

function isValidKeyFormat(raw) {
  const norm = normalizeKey(raw);
  return norm.length === KEY_LENGTH && KEY_REGEX.test(norm);
}

module.exports = {
  MAX_TEXT_CHARS,
  KEY_LENGTH,
  normalizeKey,
  isValidKeyFormat,
};
