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

test('keyboard focus stays visible on handoff controls and its launcher', () => {
  assert.match(styles, /\.handoff :focus-visible,\s*\.handoff-shortcut:focus-visible\s*\{\s*outline: 3px solid var\(--berry, #68394f\);\s*outline-offset: 3px;/);
});
test('closing a reviewed handoff clears confirmation before focus returns', () => {
  const close = script.match(/const hideHandoff = \(\) => \{([\s\S]*?)\n    \};/);
  assert.ok(close, 'the shared close action exists');
  const reviewed = {checked: true};
  const panel = {hidden: false};
  const status = {textContent: 'Copied'};
  const events = [];
  const shortcut = {
    setAttribute(name, value) { events.push([name, value]); },
    focus() { events.push(['focus', panel.hidden, reviewed.checked]); },
    scrollIntoView() {},
  };
  const syncReview = () => events.push(['sync', reviewed.checked]);
  new Function('reviewed', 'panel', 'status', 'shortcut', 'syncReview', close[1])(
    reviewed, panel, status, shortcut, syncReview
  );
  assert.equal(status.textContent, '');
  assert.deepEqual(events, [['sync', false], ['aria-expanded', 'false'], ['focus', true, false]]);
});
