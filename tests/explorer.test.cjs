const {test} = require("node:test");
const assert = require("node:assert/strict");
const engine = require("../dist/engine.js");
const {indexedSymptoms, recognizedSymptoms, scoreSymptoms, compareMatches} = require("../dist/explorer.js");

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

test("removing a symptom can increase an article's score by changing the denominator", () => {
  const baseline = scoreSymptoms(engine, ["sneezing", "runny nose", "vomiting"]);
  const hypothetical = scoreSymptoms(engine, ["sneezing", "runny nose"]);
  const [cold] = compareMatches(baseline, hypothetical);
  assert.deepEqual(cold.original.matched, cold.hypothetical.matched);
  assert.equal(cold.original.score, 41);
  assert.equal(cold.hypothetical.score, 50);
});
