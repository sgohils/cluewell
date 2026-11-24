const {test} = require("node:test");
const assert = require("node:assert/strict");
const engine = require("../dist/engine.js");
const {indexedSymptoms, scoringExplanation, recognizedSymptoms, scoreSymptoms, describeChanges, compareMatches} = require("../dist/explorer.js");

test("the evidence explorer explains score inputs, rounding, and its match threshold", () => {
  assert.match(scoringExplanation, /shared-symptom count/);
  assert.match(scoringExplanation, /selected symptoms/);
  assert.match(scoringExplanation, /symptoms indexed for that article/);
  assert.match(scoringExplanation, /rounded/);
  assert.match(scoringExplanation, /at least two shared symptoms/);
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
