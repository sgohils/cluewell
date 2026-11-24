/* Each profile indexes concepts mentioned in the linked article. All computation is local. */
(function expose(root, factory) {
  const engine = factory();
  if (typeof module === "object" && module.exports) module.exports = engine;
  else root.ClueEngine = engine;
})(globalThis, function buildEngine() {
  "use strict";

  const emergencyUrl = "https://medlineplus.gov/ency/article/001927.htm";
  const careUrl = "https://www.cdc.gov/common-cold/treatment/index.html";
  const feverUrl = "https://medlineplus.gov/ency/article/003090.htm";
  const coldExposureUrl = "https://www.cdc.gov/winter-weather/prevention/index.html";
  const limits = "This educational prototype matches English symptom phrases to three adult respiratory and allergy articles. It may miss or misread symptoms and warning signs. It cannot diagnose or determine whether it is safe to wait. Scores measure similarity to an article's indexed symptoms.";

  const concepts = [
    ["runny nose", /runny nose|running nose|nose (?:is |keeps )?running|nasal discharge/],
    ["nasal congestion", /nasal congestion|congested|congestion|(?:stuffy|blocked|stopped up) nose|nose (?:is |feels )?(?:stuffy|blocked)/],
    ["sneezing", /sneez(?:e|es|ing)/],
    ["sore throat", /sore throat|throat (?:is |feels )?sore|throat hurts|scratchy throat/],
    ["cough", /cough(?:s|ed|ing)?/],
    ["headache", /headache(?:s)?|head aches?/],
    ["body aches", /(?:body|muscle) (?:aches?|pain)|(?:aching|achy|sore) muscles|my body aches/],
    ["fever", /fever(?:s|ish)?|raised temperature|high temperature/],
    ["chills", /chills|shivering/],
    ["fatigue", /fatigue(?:d)?|tired(?:ness)?|exhaust(?:ed|ion)/],
    ["vomiting", /vomit(?:ed|ing|s)?|throwing up|threw up/],
    ["diarrhea", /diarrh(?:ea|oea)/],
    ["loss of smell", /(?:loss of|lost (?:my |the )?(?:sense of )?) ?smell|cannot smell/],
    ["loss of taste", /(?:loss of|lost (?:my |the )?(?:sense of )?) ?taste|cannot taste/],
    ["itchy or watery eyes", /(?:itchy|watery|itching|red) (?:and (?:itchy|watery|red) )?eyes?|eyes? (?:are |feel |keep )?(?:itchy|watering|itching|watery)/],
    ["itchy nose or throat", /itchy (?:nose|throat|mouth|ears)|(?:nose|throat|mouth|ears) (?:is |are |feels? )?itchy/]
  ];
  const profiles = [
    {
      name: "Common cold",
      url: "https://www.cdc.gov/common-cold/about/index.html",
      concepts: ["runny nose", "nasal congestion", "cough", "sneezing", "sore throat", "headache", "body aches", "fever"],
      explanation: "CDC lists these features among possible cold symptoms. Several respiratory infections can produce a similar story."
    }, {
      name: "Flu and COVID-19",
      url: "https://www.cdc.gov/flu/about/flu-vs-covid19.html",
      concepts: ["fever", "chills", "cough", "fatigue", "sore throat", "runny nose", "nasal congestion", "body aches", "headache", "vomiting", "diarrhea", "loss of taste", "loss of smell"],
      explanation: "CDC describes these features in both flu and COVID-19. Testing can help distinguish the two."
    }, {
      name: "Seasonal allergies",
      url: "https://www.nhs.uk/conditions/hay-fever/",
      concepts: ["sneezing", "cough", "runny nose", "nasal congestion", "itchy or watery eyes", "itchy nose or throat", "loss of smell", "headache", "fatigue"],
      explanation: "The NHS hay fever guide describes these features. Timing and a history of symptoms around pollen give a clinician additional context."
    }
  ];

  // Group related phrases under labels a reader can check against the original note.
  const warningSigns = [
    ["possible heart attack, stroke or anaphylaxis", /(?:having|had|having another|signs of|symptoms of|this (?:is|might be|could be)) (?:a |an )?(?:heart attack|stroke|anaphyla(?:xis|ctic (?:shock|reaction)))/],
    ["distress with breathing", /(?:can (?:hardly|barely)|struggl(?:e|ing) to) (?:get (?:any )?air|breathe|catch (?:my |a |their )?breath)|no way (?:i|they|she|he) can breathe|cannot (?:get (?:enough |any )?air|take a (?:deep )?breath)|unable to (?:get (?:enough |any )?air|take a breath)|(?:struggl(?:e|ing)|hard) to get (?:enough |any )?air|struggl(?:e|ing) for air|difficulty (?:in )?speaking (?:in )?full sentences/],
    ["difficulty breathing", /(?:trouble|difficulty|problems?|struggling|struggle|hard time) (?:with |in |to )?(?:breath(?:e|ing)|catching (?:my |a |their )?breath)|(?:hard|difficult|harder) to breathe|(?:cannot(?: seem to)?|unable to|barely able to|can barely|no longer able to) (?:breathe|catch (?:my |a |their )?breath)|short(?:ness)? of breath|out of breath|gasping|labou?red breathing|breathless(?:ness)?|chok(?:e|ing)|breathing (?:is |feels )?(?:very |really )?(?:hard|difficult|labou?red)/],
    ["chest pain or pressure", /chest (?:pain|pressure|tightness|hurts|discomfort|ache|heaviness)|(?:pain|pressure|tightness|heaviness|squeezing|crushing) (?:in|on|across) (?:the (?:middle|center|centre) of )?(?:my |the |their )?chest|chest (?:is |feels )?(?:tight|heavy|crushed|squeezed)|(?:weight|elephant) (?:is |sitting )*on (?:my |the |their )?chest/],
    ["blue or gray lips or skin", /(?:blue|bluish|gr[ae]y) (?:lips|skin|face)|(?:lips|skin|face) (?:are |is |look |turning |turned |looked |seem |have turned |going |went )*(?:blue|bluish|gr[ae]y)/],
    ["new confusion or change in alertness", /(?:new(?:ly)? |sudden(?:ly)? |very )?(?:confus(?:ed|ion)|disoriented)|(?:cannot|unable to|difficult to|hard to) (?:wake(?: up)?|stay awake)|unresponsive|unconscious(?:ness)?|passed out|faint(?:ed|ing)|(?:will not|does not) wake up/],
    ["possible stroke warning", /(?:face|facial|mouth) (?:is |has |started )?(?:droop(?:s|ed|ing)?)|(?:slurred|garbled) speech|(?:cannot|unable to) (?:speak|move (?:my |one |the )?(?:arm|leg))|(?:one[- ]sided|sudden) (?:weakness|numbness)|(?:left|right|one) (?:arm|leg|side)(?: of (?:my |the )?body)? (?:is |feels? |went |became |suddenly )*(?:weak|numb)|(?:blinded|lost (?:my )?vision) suddenly|sudden (?:vision loss|loss of vision)/],
    ["airway or facial swelling", /(?:swollen|swelling) (?:of (?:my |the )?)?(?:tongue|throat|face|lips)|(?:tongue|throat|face|lips) (?:is |are |feels? |started )?(?:swollen|swelling|closing)/],
    ["bleeding or blood in vomit or sputum", /(?:cough(?:ed|ing)? (?:up )?|vomit(?:ed|ing)? |throwing up |threw up )blood|(?:bleeding|blood) (?:that |which )?(?:will not|does not|cannot|will never) stop|uncontrollable bleeding|bleeding (?:heavily|profusely)/],
    ["seizure or severe sudden pain", /seizures?|worst headache|thunderclap headache|sudden(?:ly)? (?:severe|intense|excruciating) pain/],
    ["severe abdominal pain", /(?:severe|excruciating|unbearable|sudden,? sharp) (?:(?:lower |upper )?(?:abdominal|stomach|belly) (?:pain|pressure)|(?:pain|pressure) (?:in|across) (?:my |the |their )?(?:lower |upper )?(?:abdomen|stomach|belly))|(?:abdominal|stomach|belly) (?:pain|pressure) (?:is |feels |became |has become )?(?:severe|excruciating|unbearable)/],
    ["possible poisoning or overdose", /overdos(?:e|ed|ing)|swallowed (?:poison|bleach|a battery)|(?:carbon monoxide|smoke) inhalation/],
    ["immediate danger to self", /suicidal|kill myself|end my life|hurt myself/]
  ];
  const reviewSigns = [
    ["worsening symptoms", /wors(?:ening|ened)|getting worse|came back worse|returned (?:after|worse)|improved (?:and )?then (?:returned|came back)/],
    ["dehydration or difficulty keeping fluids down", /dehydrat(?:ed|ion)|(?:cannot|unable to) (?:drink|keep (?:water|fluids|liquids|anything) down)/],
    ["severe or concerning symptoms", /severe|unbearable|unusual rash|wheez(?:e|es|ing)|blood in (?:my |the )?(?:stool|urine)/],
    ["higher risk mentioned", /pregnan(?:t|cy)|immunocompromised|immunosuppressed|weakened immune system|on chemotherapy|chronic (?:lung|heart|kidney) disease/]
  ];
  const feverDays = /[5-9]|[1-9]\d+|five|six|seven|eight|nine|ten|eleven|twelve/.source;
  const feverDuration = new RegExp([
    `fever (?:has (?:been |lasted |persisted )?)?(?:for (?:the past )?|lasting |lasted |over )?(?:(?:${feverDays})[- ]days?|(?:a|one|[1-9]\\d*) weeks?)`,
    `(?:day (?:${feverDays})|(?:${feverDays}) days?) of (?:a |my |the )?fever`
  ].join("|"));
  const longDuration = /(?:(?:1[1-9]|[2-9]\d|\d{3,}|eleven|twelve|thirteen|fourteen) days|more than (?:10|ten) days|(?:two|three|four|five|six|seven|eight|nine|ten|[2-9]|[1-9]\d+) weeks?)/.source;
  const noImprovement = /(?:no improvement|without improvement|not improving|not (?:getting|feeling) better)/.source;
  const durationSubjects = [/symptoms?/, ...concepts.map(([, pattern]) => pattern)];
  const durationSuffix = ` (?:that )?(?:has |have )?(?:been )?(?:for (?:the past )?|lasting |lasted )${longDuration}`;
  const symptomDuration = new RegExp(`(?:${durationSubjects.map(pattern => pattern.source).join("|")})${durationSuffix}`);
  const continuedSymptoms = new RegExp(`${symptomDuration.source}(?:,? and| with|,)? (?:(?:is|are) )?${noImprovement}`);
  const improvementStatus = `(?:is |are |was |were )?${noImprovement}`;
  const unnamedFollowUp = new RegExp(`^\\s*(?:(?:it|they) ${improvementStatus}|${noImprovement})\\s*$`);
  const namedFollowUps = durationSubjects.map(pattern => ({
    duration: new RegExp(`(?:${pattern.source})${durationSuffix}`),
    status: new RegExp(`^\\s*(?:my |the )?(?:${pattern.source}) ${improvementStatus}\\s*$`)
  }));
  const youngAge = /[1-9]|1[0-7]|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen/.source;
  const spokenAge = `(?:${youngAge})(?:[- ](?:years?|yrs?)[- ]old|\\s*y/?o)`;
  const infantAge = `(?:\\d+|${youngAge})[- ](?:months?|weeks?|days?)[- ]old`;
  const ageIntroduction = "(?:i am|i'm|(?:my|our) (?:son|daughter|child|kid) is)";
  const pediatricContext = new RegExp([
    "(?:my|our|the) (?:infant|toddler|baby(?! shower)|child|newborn|kid)",
    "(?:an?|this) (?:infant|toddler|baby|child|newborn|kid) (?=has\\b|is\\b|with\\b)",
    `(?:my|our) (?:${spokenAge}|${infantAge})`,
    `(?:an?|the) (?:${spokenAge}|${infantAge})(?= (?:child|kid|boy|girl|has|with)\\b)`,
    `${ageIntroduction} (?:an? )?(?:${spokenAge}|${infantAge}|child|kid)`,
    `${ageIntroduction} (?:${youngAge})(?=\\s*(?:$|,|and\\b|with\\b))`
  ].join("|"));

  const temperatureValue = String.raw`[+-]?\d+(?:[.,]\d+)?`;
  const temperatureUnit = String.raw`(?:\u00b0\s*|degrees?\s*)?(?:fahrenheit|celsius|[cf])\b`;
  const ambientReadings = [
    new RegExp(String.raw`\b(room|outdoors?|outside|indoors?|inside|oven|air|water|pool|weather|ambient|forecast)(?: temperature| temp)?(?: (?:is set to|says it will be|will be|is|was|reached|of|at|says|shows))?\s*[:=]?\s*${temperatureValue}(?:\s*${temperatureUnit})?(?!\w|[.,]\d)`, "g"),
    new RegExp(String.raw`(^|[.!?;]\s*|\bit(?:'s| is| was| will be)\s+)${temperatureValue}\s*${temperatureUnit}\s+(?:outside|outdoors?|inside|indoors?|here)(?=\W|$)`, "g")
  ];
  const copiedGuidance = /^\s*(?:i (?:read|heard) that|(?:the |my )?(?:instructions|article|guide|leaflet|website) (?:says?|mentions?|lists?|warns?)|according to (?:my |the )?(?:discharge instructions|article|guide|leaflet))\b/;
  const directReport = /^\s*,?\s*(?:(?:i|we|he|she|they) (?:am|are|is|have|has|feel|feels|may be|might be)|i'm|we're|i've|we've|my|our|his|her|their)\b/;
  const futureQuestion = /^\s*(?:if |what if |what (?:should|can|do) (?:i|we) do if |will )(?:i|we|he|she|they) (?:later )?(?:get|develop|start|begin)\b/;
  const generalQuestion = /^\s*what (?:are|is) (?:the )?(?:(?:warning )?signs|symptoms) of (?:a |an )?/;
  const remoteHistory = /\b(?:(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|several|many)\s+)?(?:years?|months?) ago\b|\b(?:last|previous) year\b|\b(?:as a child|when i was (?:a )?child)\b/;
  const currentTime = /\b(?:now|currently|today|again|returned|came back|back again|still|right now|this morning|this evening)\b/;

  // Translate explicit body readings before sentence splitting so decimal points stay intact.
  // Use a unitless measurement only to request clarification; never infer Celsius or Fahrenheit.
  function labelReading(match, prefix, digits, unit) {
    const value = Number(digits.replace(",", "."));
    if (!prefix && !unit) return match;
    if (!unit) {
      const unusual = value < 35 || (value >= 39.4 && value < 95) || value >= 103;
      if (!unusual) return match;
      return prefix.startsWith("fever") ? " fever ambiguous body temperature " : " ambiguous body temperature ";
    }
    const celsius = unit.toLowerCase().startsWith("c");
    if (value < (celsius ? 35 : 95)) return " low body reading ";
    if (value >= (celsius ? 39.4 : 103)) return " high body reading fever ";
    if (value >= (celsius ? 38 : 100.4)) return " fever ";
    return match;
  }

  function clausesFrom(story) {
    const expanded = String(story ?? "").toLowerCase()
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/\b(?:can't|cant|can not)\b/g, "cannot")
      .replace(/\bwon'?t\b/g, "will not")
      .replace(/\bdon'?t\b/g, "do not")
      .replace(/\bdoesn'?t\b/g, "does not")
      .replace(/\bdidn'?t\b/g, "did not")
      .replace(/\b(is|are|was|were|has|have|had)n'?t\b/g, "$1 not")
      .replace(/\b(?:not sure|do not know|cannot tell|not certain|have no idea)(?: (?:if|whether))?\b/g, "possibly")
      .replace(/\bnot (?:only|just)\b/g, "");
    const normalized = ambientReadings.reduce((story, pattern) => story.replace(pattern, "$1 ambient reading "), expanded)
      .replace(/\b((?:temperature|temp|thermometer|fever)(?: (?:of|is|was|reads?|shows?|says|said|measured|at|reached|has reached|has been at))?\s*[:=]?\s*)?(\d{2,3}(?:[.,]\d+)?)(?!\d|[.,]\d)\s*(?:°\s*|degrees?\s*)?(fahrenheit\b|celsius\b|[fc]\b)?/g, labelReading);
    return normalized.split(/[.!?;\n]|\b(?:but|however|except|other than|now|although|yet|despite)\b|,\s*(?=actually\b)|\b(?:or|because)\s+(?=(?:i|my|we|he|she|they|it|there)\b)|(?:,\s*|\b(?:and|then)\s+)(?=(?:i|my|we|he|she|they|it|there|have|having|feeling|developed|started|with|still|just|only|cannot|unable|experiencing|positive for)\b)/)
      .filter(clause => {
        if (!clause || generalQuestion.test(clause) || futureQuestion.test(clause)) return false;
        const reference = copiedGuidance.exec(clause);
        return !reference || directReport.test(clause.slice(reference[0].length));
      });
  }

  function asserted(clauses, pattern, warning = false) {
    const matcher = new RegExp("\\b(?:" + pattern.source + ")\\b", "g");
    return clauses.some(clause => {
      for (const match of clause.matchAll(matcher)) {
        const before = clause.slice(0, match.index);
        const after = clause.slice(match.index + match[0].length);
        // A clearly remote event is not a current warning sign unless the same clause also says it is happening again now.
        if (warning && remoteHistory.test(clause) && !currentTime.test(clause)) continue;
        // Carry a negative across a coordinated list ("no fever, chills or cough").
        // A new affirmative verb resets the scope ("no fever, developed a cough").
        // "No appetite and difficulty breathing" may pair a denial with a new warning.
        // Treat that ambiguous conjunction as a possible emergency while preserving "or" lists.
        const scope = warning ? before.split(/\band\b/).pop() : before;
        const context = scope.split(/\b(?:also have)\b/).pop();
        const denied = /\b(?:no|without|den(?:y|ies|ied)|negative for|absence of|free of|never|not(?: having)?|zero)\b/.test(context);
        const explicitlyAbsent = /^\s+(?:(?:is|are|has|have|had|was|were)\s+)?(?:absent|denied|ruled out|never happened|not (?:present|reported|observed|a symptom))\b(?!\s+until\b)/.test(after);
        const resolved = /^\s+(?:(?:is|are|has|have|had|was|were)\s+)?(?:gone|resolved|subsided|went away)\b/.test(after);
        // A recently described red flag can matter even when the symptom has subsided.
        if (!denied && !explicitlyAbsent && (warning || !resolved)) return true;
      }
      return false;
    });
  }

  function retrieve(signals) {
    const matches = [];
    for (const profile of profiles) {
      const matched = signals.filter(signal => profile.concepts.includes(signal));
      if (matched.length < 2) continue;
      const score = Math.round(100 * matched.length / Math.sqrt(signals.length * profile.concepts.length));
      matches.push({name: profile.name, url: profile.url, score, matched, explanation: profile.explanation});
    }
    return matches.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  }

  function hasPersistentSymptoms(clauses) {
    if (asserted(clauses, continuedSymptoms)) return true;
    return clauses.some((clause, index) => {
      const nextClause = clauses[index + 1];
      if (!nextClause || !asserted([clause], symptomDuration)) return false;
      return unnamedFollowUp.test(nextClause) || namedFollowUps.some(({duration, status}) =>
        status.test(nextClause) && asserted([clause], duration));
    });
  }

  function analyze(story, options = {}) {
    const clauses = clausesFrom(story);
    const flags = warningSigns.filter(([, pattern]) => asserted(clauses, pattern, true)).map(([label]) => label);
    const lowReading = asserted(clauses, /low body reading/);
    const feverWithWarning = asserted(clauses, /fever|feverish/) && asserted(clauses, /stiff neck|neck (?:is |feels )?stiff|(?:severe|very bad) headache/);
    if (lowReading) flags.push("reported body temperature below 95°F (35°C)");
    if (feverWithWarning) flags.push("fever with neck stiffness or severe headache");
    if (options.redflag === true) flags.unshift("current warning sign selected");
    if (flags.length) {
      return {
        level: "emergency", title: "Call emergency services now",
        next: "If this describes what is happening, call 911 in the U.S. or your local emergency number now.",
        rationale: "A possible emergency warning sign takes priority over article matching.",
        matches: [], signals: flags, limits, careUrl: lowReading ? coldExposureUrl : feverWithWarning ? feverUrl : emergencyUrl
      };
    }
    const signals = concepts.filter(([, pattern]) => asserted(clauses, pattern)).map(([label]) => label);
    const matches = retrieve(signals);
    const review = reviewSigns.filter(([, pattern]) => asserted(clauses, pattern)).map(([label]) => label);
    if (asserted(clauses, feverDuration)) review.push("persistent fever");
    const highReading = asserted(clauses, /high body reading/);
    const unclearReading = asserted(clauses, /ambiguous body temperature/);
    if (highReading) review.push("reported high temperature");
    if (unclearReading) review.push("temperature unit needs confirmation");
    if (hasPersistentSymptoms(clauses)) {
      review.push("persistent symptoms without improvement");
    }
    if (options.risk === "yes") review.push("higher-risk context selected");
    const child = asserted(clauses, pediatricContext);
    if (child || review.length) {
      return {
        level: "prompt", title: child ? "Get age-specific guidance" : "Contact a clinician promptly",
        next: child ? "Contact a pediatric clinician promptly about the symptoms. For an emergency, call 911 in the U.S. or your local emergency number."
          : highReading || unclearReading ? "Contact a healthcare professional now about the temperature reading. Share the number, unit, measurement method and when you took it. Call emergency services if you think this is an emergency."
          : "Contact a healthcare professional today and share your symptoms and when they started. If you think this is an emergency, call your local emergency number now.",
        rationale: child ? "This tool indexes adult guidance. Children need assessment suited to their age."
          : "Your description or selected context includes a reason to seek individual advice.",
        signals: [...signals, ...review], matches: child ? [] : matches, limits, careUrl: highReading || unclearReading ? feverUrl : careUrl
      };
    }
    if (!matches.length) {
      return {
        level: "unknown", title: "Too little overlap to rank articles",
        next: "Contact a clinician or nurse advice line for help deciding what to do. If you think this may be an emergency, call your local emergency number.",
        rationale: "The note needs at least two distinct recognized symptoms from the same indexed article. Many symptoms and conditions are outside this collection.",
        matches: [], signals, limits, careUrl: emergencyUrl
      };
    }
    return {
      level: "guidance", title: "Review the guidance and track changes",
      next: "Use the articles below to prepare questions for a clinician. Seek care for severe, worsening, or concerning symptoms. If you may be at higher risk from a respiratory infection, contact your clinician promptly.",
      rationale: "Multiple details in your story also appear in the linked articles. The same symptoms can appear in several conditions.",
      signals, matches, limits, careUrl
    };
  }
  return {analyze};
});
