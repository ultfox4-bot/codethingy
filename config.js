// Backend URL for Ultfox Code Redeemer.
// This points at the Emergent-hosted preview backend so the keystore is
// shared across every device that runs the app.
//
// To override at runtime, set the ULTFOX_BACKEND_URL environment variable
// before launching the app.
const DEFAULT_BACKEND_URL =
  'https://ultfox-code-redeemer.preview.emergentagent.com';

const BACKEND_URL = (
  process.env.ULTFOX_BACKEND_URL ||
  DEFAULT_BACKEND_URL
).replace(/\/+$/, '');

const NOTIFY_EMAIL = 'Ultfox4@gmail.com';

module.exports = { BACKEND_URL, NOTIFY_EMAIL };
