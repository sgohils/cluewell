const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const script = fs.readFileSync(path.join(__dirname, '../dist/handoff.js'), 'utf8');
const styles = fs.readFileSync(path.join(__dirname, '../dist/handoff.css'), 'utf8');

test('changing a previously copied or confirmed handoff clears its stale status', () => {
  assert.match(script, /const invalidateReview = \(\) => \{[\s\S]*?status\.textContent = wasReviewed \? 'Note changed\. Review it again before sharing\.' : '';[\s\S]*?\};/);
});

test('Escape closes the open handoff and restores focus through the shared close action', () => {
  assert.match(script, /panel\.addEventListener\('keydown', event => \{\s*if \(event\.key === 'Escape' && !panel\.hidden\) \{\s*event\.preventDefault\(\);\s*hideHandoff\(\);/);
  assert.match(script, /const hideHandoff = \(\) => \{[\s\S]*?shortcut\.focus\(\{ preventScroll: true \}\);/);
});
