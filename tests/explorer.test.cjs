const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const engine = require("../dist/engine.js");
const {indexedSymptoms, scoringExplanation, comparisonRegionLabel, recognizedSymptoms, scoreSymptoms, describeChanges, compareMatches, describeSelection} = require("../dist/explorer.js");

test("the evidence explorer explains score inputs, rounding, and its match threshold", () => {
  assert.match(scoringExplanation, /shared-symptom count/);
  assert.match(scoringExplanation, /selected symptoms/);
  assert.match(scoringExplanation, /symptoms indexed for that article/);
  assert.match(scoringExplanation, /rounded/);
  assert.match(scoringExplanation, /at least two shared symptoms/);
});

test("the comparison table announces its horizontal scroll behavior to keyboard and screen-reader users", () => {
  assert.match(comparisonRegionLabel, /Article comparison/);
  assert.match(comparisonRegionLabel, /small screens/);
  assert.match(comparisonRegionLabel, /scroll horizontally/);
  assert.match(comparisonRegionLabel, /Original and What-if scores/);
});

test("the canonical symptom labels round-trip through the existing engine", () => {
  for (const symptom of indexedSymptoms) {
    const result = engine.analyze("I have " + symptom + ".");
    assert.deepEqual(result.signals, [symptom]);
  }
});

test("the simulation uses the original recognized symptoms and the same scores", () => {
  const result = engine.analyze("My symptoms are getting worse. I have a runny nose, sneezing, and a sore throat.");
  assert.deepEqual(recognizedSymptoms(result.signals), ["runny nose", "sneezing", "sore throat"]);
  assert.deepEqual(scoreSymptoms(engine, result.signals), result.matches);
  assert.deepEqual(scoreSymptoms(engine, ["sneezing", "sneezing", "unrecognized"]), []);
});

test("selection changes describe additions and removals independent of symptom order", () => {
  const baseline = ["runny nose", "sneezing"];
  assert.equal(describeChanges(baseline, [...baseline].reverse()), "");
  assert.equal(describeChanges(baseline, ["sneezing", "cough", "headache"]),
    "Added cough, headache. Removed runny nose.");
  assert.equal(describeChanges(["sneezing", "runny nose"], ["headache", "cough", "sneezing"]),
    "Added cough, headache. Removed runny nose.");
  assert.equal(describeChanges(baseline, []), "Removed runny nose, sneezing.");
});

test("the live selection summary reports the original match count and threshold", () => {
  assert.equal(describeSelection(["cough", "fever"], ["cough", "fever"], 2),
    "The original symptoms are selected. 2 articles share at least two of the selected symptoms.");
  assert.equal(describeSelection(["cough", "fever"], ["sneezing"], 1),
    "Added sneezing. Removed cough, fever. One article shares at least two of the selected symptoms.");
  assert.equal(describeSelection(["cough", "fever"], [], 0),
    "Removed cough, fever. No articles share at least two of the selected symptoms.");
});


test("articles can enter or leave the comparison at the two-symptom threshold", () => {
  const baseline = scoreSymptoms(engine, ["cough", "fever"]);
  const hypothetical = scoreSymptoms(engine, ["sneezing", "itchy or watery eyes"]);
  const comparison = compareMatches(baseline, hypothetical);
  assert.deepEqual(comparison.map(({name, original, hypothetical}) => [
    name, original?.score ?? null, hypothetical?.score ?? null
  ]), [
    ["Common cold", 50, null],
    ["Flu and COVID-19", 39, null],
    ["Seasonal allergies", null, 47]
  ]);
});

test("one shared symptom stays below threshold and appears as leaving evidence", () => {
  const baseline = scoreSymptoms(engine, ["cough", "fever"]);
  const hypothetical = scoreSymptoms(engine, ["fever", "itchy or watery eyes"]);
  assert.deepEqual(hypothetical, []);

  const comparison = compareMatches(baseline, hypothetical);
  assert.deepEqual(comparison.map(({name, original, hypothetical}) => [
    name, original?.matched.length, hypothetical
  ]), [
    ["Common cold", 2, null],
    ["Flu and COVID-19", 2, null]
  ]);
});

test("article URLs preserve provenance for scores on either side", () => {
  const baseline = scoreSymptoms(engine, ["cough", "fever"]);
  const hypothetical = scoreSymptoms(engine, ["cough", "sneezing"]);
  const comparison = compareMatches(baseline, hypothetical);
  assert.deepEqual(comparison.map(match => match.url), [
    "https://www.cdc.gov/common-cold/about/index.html",
    "https://www.cdc.gov/flu/about/flu-vs-covid19.html",
    "https://www.nhs.uk/conditions/hay-fever/"
  ]);
  for (const match of comparison) {
    assert.equal(match.url, (match.original ?? match.hypothetical).url);
  }
  assert.equal(comparison[0].original.url, comparison[0].hypothetical.url);
  assert.equal(comparison[2].original, null);
});

test("removing a symptom can increase an article's score by changing the denominator", () => {
  const baseline = scoreSymptoms(engine, ["sneezing", "runny nose", "vomiting"]);
  const hypothetical = scoreSymptoms(engine, ["sneezing", "runny nose"]);
  const [cold] = compareMatches(baseline, hypothetical);
  assert.deepEqual(cold.original.matched, cold.hypothetical.matched);
  assert.equal(cold.original.score, 41);
  assert.equal(cold.hypothetical.score, 50);
});

test("original and what-if scores can be equal with different shared symptoms", () => {
  const baseline = scoreSymptoms(engine, ["runny nose", "sneezing"]);
  const hypothetical = scoreSymptoms(engine, ["runny nose", "cough"]);
  const [cold] = compareMatches(baseline, hypothetical);
  assert.equal(cold.original.score, cold.hypothetical.score);
  assert.deepEqual(cold.original.matched, ["runny nose", "sneezing"]);
  assert.deepEqual(cold.hypothetical.matched, ["runny nose", "cough"]);
});

test("comparing a selection with itself keeps one fully populated row per article", () => {
  const matches = scoreSymptoms(engine, ["runny nose", "sneezing", "cough"]);
  const before = structuredClone(matches);
  const comparison = compareMatches(matches, matches);

  assert.deepEqual(comparison.map(({url, original, hypothetical}) => ({
    url,
    original: {score: original.score, matched: original.matched},
    hypothetical: {score: hypothetical.score, matched: hypothetical.matched}
  })), matches.map(match => ({
    url: match.url,
    original: {score: match.score, matched: match.matched},
    hypothetical: {score: match.score, matched: match.matched}
  })));
  assert.equal(new Set(comparison.map(match => match.url)).size, comparison.length);
  assert.deepEqual(matches, before);
});

test("the browser explorer mounts, updates the comparison, and restores the original selection", () => {
  class Element {
    constructor(tagName) {
      this.tagName = tagName;
      this.children = [];
      this.attributes = {};
      this.listeners = {};
      this.className = "";
      this.value = "";
      this.checked = false;
      this.classList = {add: name => { this.className = [this.className, name].filter(Boolean).join(" "); }};
    }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    setAttribute(name, value) { this.attributes[name] = value; }
    addEventListener(name, callback) { this.listeners[name] = callback; }
    querySelector(selector) {
      if (selector === ".evidence-explorer") return this.descendants().find(node => node.className.split(" ").includes("evidence-explorer")) ?? null;
      return null;
    }
    querySelectorAll(selector) {
      if (selector === ".signal-list li") return this.signalItems ?? [];
      return this.descendants().filter(node => selector === "input" && node.tagName === "input");
    }
    descendants() { return this.children.flatMap(node => [node, ...node.descendants()]); }
    get textContent() { return this._textContent ?? this.children.map(child => child.textContent).join(""); }
    set textContent(value) { this._textContent = value; }
  }
  const evidence = new Element("section");
  const results = new Element("main");
  results.evidence = evidence;
  results.signalItems = ["runny nose", "sneezing", "sore throat"].map(textContent => ({textContent}));
  results.querySelector = selector => selector === ".evidence" ? evidence : null;
  results.querySelectorAll = selector => selector === ".signal-list li" ? results.signalItems : [];
  class Observer { constructor(callback) { this.callback = callback; } observe() {} }
  const document = {getElementById: id => id === "results" ? results : null, createElement: tag => new Element(tag)};
  const sandbox = {document, ClueEngine: engine, MutationObserver: Observer, URL, Map, Set};
  vm.runInNewContext(fs.readFileSync(require.resolve("../dist/explorer.js"), "utf8"), sandbox);

  const panel = evidence.querySelector(".evidence-explorer");
  assert.ok(panel);
  const controls = panel.querySelectorAll("input");
  const sneezing = controls.find(control => control.value === "sneezing");
  assert.equal(sneezing.checked, true);
  const status = panel.descendants().find(node => node.className.split(" ").includes("explorer-status"));
  assert.match(status.textContent, /The original symptoms are selected/);
  const tableBody = panel.descendants().find(node => node.tagName === "tbody");
  assert.ok(tableBody.children.length > 0);

  sneezing.checked = false;
  panel.descendants().find(node => node.tagName === "fieldset").listeners.change();
  assert.match(status.textContent, /Removed sneezing/);
  assert.ok(tableBody.children.length > 0);
  assert.ok(panel.descendants().some(node => node.className.split(" ").includes("explorer-score-missing")));

  for (const control of controls) control.checked = false;
  panel.descendants().find(node => node.tagName === "fieldset").listeners.change();
  assert.match(status.textContent, /No articles share at least two/);
  assert.match(status.textContent, /Removed runny nose, sneezing, sore throat/);
  assert.ok(tableBody.children.length > 0, "original rows remain for side-by-side context");

  panel.descendants().find(node => node.className.split(" ").includes("explorer-reset")).listeners.click();
  assert.equal(sneezing.checked, true);
  assert.match(status.textContent, /The original symptoms are selected/);
});
