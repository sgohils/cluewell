const {test} = require("node:test");
const assert = require("node:assert/strict");
const {analyze} = require("../dist/engine.js");

const cold = "Since yesterday I have had a runny nose, sneezing, and a sore throat.";

test("judge demo returns the source, the matching features and a reproducible score", () => {
  const result = analyze(cold, {risk: "unknown"});
  assert.equal(result.level, "guidance");
  const [first] = result.matches;
  assert.equal(first.name, "Common cold");
  assert.equal(first.score, Math.round(100 * 3 / Math.sqrt(3 * 8)));
  assert.deepEqual([...first.matched].sort(), ["runny nose", "sneezing", "sore throat"].sort());
  assert.equal(first.url, "https://www.cdc.gov/common-cold/about/index.html");
  assert.deepEqual(analyze(cold + " Sneezing, sneezing.").matches, result.matches);
});

test("the same feature can be included by several sources", () => {
  const result = analyze("I have a runny nose, stuffy nose and cough.");
  assert.equal(result.matches.length, 3);
  for (const match of result.matches) {
    assert.equal(match.matched.length, 3);
    assert.ok(match.score >= 0 && match.score <= 100);
    assert.ok(match.url.startsWith("https://"));
  }
  for (const [index, match] of result.matches.entries()) {
    if (index > 0) assert.ok(match.score <= result.matches[index - 1].score);
  }
});

test("equal displayed scores remain tied", () => {
  const result = analyze("runny nose, congestion, cough, sneezing, sore throat, headache, body aches");
  assert.equal(result.matches[1].score, 63);
  assert.equal(result.matches[2].score, 63);
});

test("allergy symptoms retrieve the NHS article", () => {
  const [first] = analyze("My eyes are itchy, I keep sneezing and I have a runny nose.").matches;
  assert.equal(first.name, "Seasonal allergies");
});

test("overlapping viral symptoms produce a joint flu and COVID article", () => {
  const [first] = analyze("I feel feverish and I have chills, fatigue, and body aches.").matches;
  assert.equal(first.name, "Flu and COVID-19");
});

for (const story of [
  "I now have chest pain and trouble breathing.",
  cold + " I now have chest pain and trouble breathing.",
  "No fever or cough but I can’t catch my breath.",
  "No chest pain yesterday; now there is pressure in my chest.",
  "I don't know if this is chest pain.",
  "I am not only sneezing, I'm gasping.",
  "No fever, my lips are turning blue.",
  "My face is drooping. My speech is slurred.",
  "My tongue is swelling.",
  "I no longer have a cough but my right arm is suddenly numb.",
  "He won't wake up.",
  "I'm coughing up blood.",
  "My throat is closing.",
  "Trouble catching my breath.",
  "No fever and cannot breathe.",
  "I have no appetite and difficulty breathing.",
  "No symptoms other than chest pain.",
  "Chest pain went away but just came back.",
  "My slurred speech went away.",
  "It feels like an elephant is sitting on my chest.",
  "I think I am having a heart attack.",
  "I can hardly breathe.",
  "I can’t get enough air."
]) {
  test("possible emergency takes priority: " + story, () => {
    const result = analyze(story);
    assert.equal(result.level, "emergency");
    assert.equal(result.matches.length, 0);
    assert.equal(result.careUrl, "https://medlineplus.gov/ency/article/001927.htm");
  });
}

test("explicit warning sign overrides an empty or benign note", () => {
  assert.equal(analyze("", {redflag: true}).level, "emergency");
  assert.equal(analyze(cold, {redflag: true, risk: "yes"}).level, "emergency");
});

test("negated signs in a list and explicit corrections do not become positive evidence", () => {
  const result = analyze("No fever, chills or chest pain. I have sneezing and a runny nose.");
  assert.equal(result.level, "guidance");
  assert.deepEqual(result.signals.sort(), ["runny nose", "sneezing"].sort());
  assert.equal(analyze("Chest pain is absent. My sore throat is gone.").level, "unknown");
  assert.deepEqual(analyze("No fever, just a cough and sore throat.").signals.sort(), ["cough", "sore throat"]);
});

for (const story of ["", "Cough.", "I fell on my ankle.", "I do not have fever, cough or sneezing.", "sneezing sneezing sneezing"]) {
  test("abstains for limited or outside-collection evidence: " + story, () => {
    assert.equal(analyze(story).level, "unknown");
    assert.deepEqual(analyze(story).matches, []);
  });
}

test("risk, worsening and age can change the care step independently of the ranking", () => {
  assert.equal(analyze(cold, {risk: "yes"}).level, "prompt");
  assert.equal(analyze(cold + " My symptoms are getting worse.").level, "prompt");
  assert.equal(analyze(cold + " I am immunocompromised.").level, "prompt");
  assert.equal(analyze("I have a cough and a fever for six days.").level, "prompt");
  assert.equal(analyze("I've had a cough for two weeks and it is not getting better.").level, "prompt");
  const child = analyze("My baby has a runny nose and keeps sneezing.");
  assert.equal(child.level, "prompt");
  assert.deepEqual(child.matches, []);
});

test("severe pain in the abdomen takes priority over cold article matches", () => {
  const result = analyze(cold + " I have severe pain in my abdomen.");
  assert.equal(result.level, "emergency");
  assert.deepEqual(result.matches, []);
  assert.ok(result.signals.includes("severe abdominal pain"));
});

test("a denied warning sign stays denied across coordinated symptoms", () => {
  for (const denial of [
    "I am not experiencing chest pain.",
    "I am not experiencing chest pain or having trouble breathing."
  ]) {
    const result = analyze(cold + " " + denial);
    assert.equal(result.level, "guidance");
    assert.deepEqual(result.matches, analyze(cold).matches);
  }
});

test("high temperatures in either unit prompt immediate clinician contact", () => {
  for (const reading of ["105.2°F", "40.7 degrees Celsius"]) {
    const result = analyze(cold + " My temperature is " + reading + ".");
    assert.equal(result.level, "prompt");
    assert.match(result.next, /professional now/);
    assert.ok(result.signals.includes("reported high temperature"));
    assert.equal(result.careUrl, "https://medlineplus.gov/ency/article/003090.htm");
  }
});

test("an unusual reading with no unit asks the reader to confirm the unit", () => {
  const result = analyze(cold + " My temperature is 105.2.");
  assert.equal(result.level, "prompt");
  assert.ok(result.signals.includes("temperature unit needs confirmation"));
  assert.ok(!result.signals.includes("reported high temperature"));
});

test("a low body temperature takes priority while weather readings do not", () => {
  const result = analyze(cold + " My oral temperature is 94.9°F.");
  assert.equal(result.level, "emergency");
  assert.deepEqual(result.matches, []);
  assert.equal(result.careUrl, "https://www.cdc.gov/winter-weather/prevention/index.html");
  assert.deepEqual(analyze(cold + " Outside was -10°C."), analyze(cold));
});

test("reported fever with a stiff neck takes priority even if the unit is missing", () => {
  for (const reading of ["102°F", "105.2"]) {
    const result = analyze(cold + " I have a fever of " + reading + " and a stiff neck.");
    assert.equal(result.level, "emergency");
    assert.ok(result.signals.includes("fever with neck stiffness or severe headache"));
    assert.deepEqual(result.matches, []);
  }
});
