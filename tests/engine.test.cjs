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

test("whole-body pain wording counts as body aches", () => {
  const result = analyze("My whole body hurts and I have a cough.");
  assert.ok(result.signals.includes("body aches"));
  assert.ok(result.matches.some(({name}) => name === "Common cold"));
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

test("past-tense sneeze wording counts toward article matching", () => {
  const result = analyze("I sneezed repeatedly and have a runny nose.");
  assert.ok(result.signals.includes("sneezing"));
  assert.ok(result.matches.some(({name}) => name === "Common cold"));
});

test("plugged nose wording counts as nasal congestion", () => {
  const result = analyze("My nose is plugged and I have a cough.");
  assert.ok(result.signals.includes("nasal congestion"));
  assert.ok(result.matches.some(({name}) => name === "Common cold"));
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
  "My lips went blue.",
  "No symptoms other than chest pain.",
  "Chest pain went away but just came back.",
  "My slurred speech went away.",
  "It feels like an elephant is sitting on my chest.",
  "I think I am having a heart attack.",
  "I can hardly breathe.",
  "I can't get enough air.",
  "I can't get a breath."
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

test("a corrective clause after a comma resets an earlier warning denial", () => {
  const result = analyze("No trouble breathing, actually my chest hurts.");
  assert.equal(result.level, "emergency");
  assert.ok(result.signals.includes("chest pain or pressure"));
});

test("clearly remote warning signs do not become current without a current-time cue", () => {
  for (const story of [
    "I had chest pain ten years ago. Today I have a runny nose and sneezing.",
    "My sister had chest pain years ago. I have a runny nose and sneezing."
  ]) {
    assert.equal(analyze(story).level, "guidance", story);
  }
  assert.equal(analyze("I had chest pain years ago, but my chest hurts again now.").level, "emergency");
  for (const story of [
    "I had chest pain years ago. My chest feels tight.",
    "My sister had chest pain years ago; now I can hardly breathe.",
    "I had chest pain years ago, but today I am gasping for air."
  ]) {
    assert.equal(analyze(story).level, "emergency", story);
  }
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

test("spoken breathing and chest descriptions keep warning priority", () => {
  for (const story of [
    "I’m struggling for air.",
    "My breathing is very difficult.",
    "I can’t seem to catch my breath.",
    "I've got pain in the middle of my chest."
  ]) {
    const result = analyze(cold + " " + story);
    assert.equal(result.level, "emergency", story);
    assert.deepEqual(result.matches, []);
  }
});

test("contracted denials do not trigger warning signs", () => {
  for (const denial of ["I haven't had trouble breathing.", "My lips aren’t blue."]) {
    assert.deepEqual(analyze(cold + " " + denial), analyze(cold), denial);
  }
});

test("duration follows the reported symptom rather than an unrelated number", () => {
  for (const story of [
    "This is day five of my fever, with a runny nose.",
    "My fever has persisted for 5 days and I have a sore throat.",
    "I have been sneezing for 11 days with no improvement."
  ]) {
    assert.equal(analyze(story).level, "prompt", story);
  }
  for (const story of [
    "I have a fever and a runny nose, but it started 4 days ago.",
    "I have a fever and a runny nose. I travel in 11 days. The runny nose is not improving.",
    "I have a runny nose that is not improving. My package arrived 14 days ago."
  ]) {
    assert.notEqual(analyze(story).level, "prompt", story);
  }
});

test("temperature parsing distinguishes measured readings from ambient readings", () => {
  const ambiguous = analyze(cold + " The thermometer says 105.2.");
  assert.equal(ambiguous.level, "prompt");
  assert.ok(ambiguous.signals.includes("temperature unit needs confirmation"));
  const high = analyze(cold + " My body temperature measured 40,7 °C.");
  assert.equal(high.level, "prompt");
  assert.ok(high.signals.includes("reported high temperature"));
  for (const context of ["The forecast says it will be 105°F.", "The oven is set to 104 °F."]) {
    assert.deepEqual(analyze(cold + " " + context), analyze(cold), context);
  }
});

test("copied guidance and future scenarios do not become asserted symptoms", () => {
  for (const context of [
    "The instructions say to get help for chest pain or trouble breathing.",
    "I read that throat swelling can be serious.",
    "What if I develop chest pain tomorrow?"
  ]) {
    assert.deepEqual(analyze(cold + " " + context), analyze(cold), context);
  }
});

test("uncertain current symptoms and affirmative reports still trigger matching", () => {
  for (const story of [
    "I’m not sure if this is chest pain.",
    "The instructions mention difficulty breathing. I am struggling to breathe.",
    "The instructions say chest pain is serious, and I have chest pain now."
  ]) {
    assert.equal(analyze(cold + " " + story).level, "emergency", story);
  }
});

test("common age wording routes pediatric notes outside the adult article collection", () => {
  for (const story of [
    "I’m 16 and I have a runny nose and a sore throat.",
    "My 6yo son is sneezing and has a runny nose.",
    "My eight-year-old has a runny nose and a sore throat."
  ]) {
    const result = analyze(story);
    assert.equal(result.level, "prompt", story);
    assert.equal(result.title, "Get age-specific guidance");
    assert.deepEqual(result.matches, []);
  }
  assert.equal(analyze("My 6yo son is struggling for air.").level, "emergency");
  for (const context of ["I am 16 minutes from home.", "I’m 36 years old."]) {
    assert.deepEqual(analyze(cold + " " + context), analyze(cold), context);
  }
});

test("explicit absence and current uncertainty retain distinct meanings", () => {
  for (const story of ["Chest pain isn't present.", "Shortness of breath was not reported."]) {
    assert.deepEqual(analyze(cold + " " + story), analyze(cold), story);
  }
  for (const story of ["I have no idea whether this is chest pressure.", "No fever despite difficulty breathing.", "Chest pain was not present until today."]) {
    assert.equal(analyze(cold + " " + story).level, "emergency", story);
  }
});

test("ambient temperatures do not replace a reported body reading", () => {
  for (const context of ["It was 85 degrees Fahrenheit outside.", "The room temperature is 105.", "The pool temperature was 20°C."]) {
    assert.deepEqual(analyze(cold + " " + context), analyze(cold), context);
  }
  const result = analyze(cold + " It was 85°F outside. My temp has been at 105.2.");
  assert.equal(result.level, "prompt");
  assert.ok(result.signals.includes("temperature unit needs confirmation"));
  assert.ok(!result.signals.includes("reported high temperature"));
});

test("quoted instructions and worries about future symptoms do not assert current symptoms", () => {
  for (const context of [
    "The leaflet says chest pain means I should call for help.",
    "According to my discharge instructions, trouble breathing means I should call for help.",
    "What should I do if I get severe chest pain tomorrow?",
    "What if I get chest pain or trouble breathing tomorrow?",
    "Will I develop trouble breathing?",
    "What are the signs of a stroke?"
  ]) {
    assert.deepEqual(analyze(cold + " " + context), analyze(cold), context);
  }
  for (const context of [
    "The leaflet says chest pain means I should call for help, and I have chest pain.",
    "What are the signs of a stroke? My face is drooping.",
    "What are the signs of a stroke because my face is drooping?",
    "The leaflet says I may be having a stroke.",
    "I can't tell if I have chest pain."
  ]) {
    assert.equal(analyze(cold + " " + context).level, "emergency", context);
  }
});

test("prolonged symptoms are linked to their own lack of improvement", () => {
  for (const story of [
    "I have been sneezing for more than 10 days without improvement.",
    "I have had a cough for two weeks. My cough isn't getting better.",
    "My cough has lasted 11 days and is not getting better."
  ]) {
    assert.ok(analyze(story).signals.includes("persistent symptoms without improvement"), story);
  }
  for (const story of [
    "I have had a cough for 12 days. Today's headache is not getting better.",
    "I have had a cough for 12 days. My Wi-Fi is not improving.",
    "I have had a cough for 10 days with no improvement."
  ]) {
    assert.ok(!analyze(story).signals.includes("persistent symptoms without improvement"), story);
  }
});

test("age reported for the current patient controls adult article eligibility", () => {
  for (const story of [
    "My daughter is 6 years old and has a runny nose and a sore throat.",
    "My twelve-week-old has a runny nose and is sneezing.",
    "A 16-year-old has a cough and a sore throat.",
    "I am 17 yrs old and I have a runny nose and a sore throat."
  ]) {
    const result = analyze(story);
    assert.equal(result.level, "prompt", story);
    assert.equal(result.title, "Get age-specific guidance");
    assert.deepEqual(result.matches, []);
  }
  for (const context of ["I had asthma as a child.", "I used to get this when I was a child.", "My baby shower is next week."]) {
    assert.deepEqual(analyze(cold + " " + context), analyze(cold), context);
  }
});
