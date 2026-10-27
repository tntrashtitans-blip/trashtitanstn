'use strict';

const path = require('path');
const { notifyIndexNow } = require(path.join(__dirname, '..', '..', '..', 'scripts', 'indexnow'));

function showStatus(utils, state, summary) {
  if (!utils || !utils.status || typeof utils.status.show !== 'function') return;
  try {
    utils.status.show({
      title: 'IndexNow',
      summary: summary,
      state: state,
    });
  } catch (err) {
    console.error('Could not set IndexNow status:', err.message || err);
  }
}

module.exports = {
  // Runs only after a successful production deploy (see netlify.toml),
  // once the key file is part of the live site. A ping failure is a warning.
  async onSuccess({ utils }) {
    try {
      const result = await notifyIndexNow({ retry: true });
      const summary =
        'Submitted ' +
        result.count +
        ' URL(s) (HTTP ' +
        result.status +
        '). Key file: ' +
        result.keyLocation;
      console.log(summary);
      showStatus(utils, 'success', summary);
    } catch (err) {
      const summary = err && err.message ? err.message : String(err);
      console.error('IndexNow ping failed:', summary);
      showStatus(
        utils,
        'warning',
        summary + ' The site deploy is still live. Re-run: node scripts/indexnow.js'
      );
    }
  },
};
