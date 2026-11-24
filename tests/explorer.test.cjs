const {test} = require("node:test");
const assert = require("node:assert/strict");
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
