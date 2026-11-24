(function expose(root) {
  "use strict";

  const indexedSymptoms = Object.freeze([
    "runny nose", "nasal congestion", "sneezing", "sore throat",
    "cough", "headache", "body aches", "fever", "chills", "fatigue",
    "vomiting", "diarrhea", "loss of smell", "loss of taste",
    "itchy or watery eyes", "itchy nose or throat"
  ]);

  function recognizedSymptoms(signals) {
    return indexedSymptoms.filter(symptom => signals.includes(symptom));
  }

  function scoreSymptoms(engine, symptoms) {
    const story = recognizedSymptoms(symptoms)
      .map(symptom => "I have " + symptom + ".")
      .join(" ");
    return engine.analyze(story).matches;
  }

  function compareMatches(original, hypothetical) {
    const originalByName = new Map(original.map(match => [match.name, match]));
    const hypotheticalByName = new Map(hypothetical.map(match => [match.name, match]));
    const names = new Set([...originalByName.keys(), ...hypotheticalByName.keys()]);
    return [...names].map(name => ({
      name,
      original: originalByName.get(name) ?? null,
      hypothetical: hypotheticalByName.get(name) ?? null
    }));
  }

  if (typeof module === "object" && module.exports) {
    module.exports = {indexedSymptoms, recognizedSymptoms, scoreSymptoms, compareMatches};
    return;
  }

  const {document, ClueEngine, MutationObserver} = root;
  const results = document.getElementById("results");
  if (!results || !ClueEngine || !MutationObserver) return;

  function create(tag, text, className) {
    const element = document.createElement(tag);
    if (text) element.textContent = text;
    if (className) element.className = className;
    return element;
  }

  function scoreCell(match) {
    return create("td", match ? match.score + "/100" : "Below threshold");
  }

  function renderComparison(body, original, hypothetical) {
    const rows = compareMatches(original, hypothetical).map(match => {
      const row = create("tr");
      const name = create("th", match.name);
      name.scope = "row";
      if (match.hypothetical) {
        name.append(create("span", "Shared what-if symptoms include " + match.hypothetical.matched.join(", "), "explorer-shared"));
      }
      row.append(name, scoreCell(match.original), scoreCell(match.hypothetical));
      return row;
    });
    body.replaceChildren(...rows);
  }

  function mountExplorer() {
    const evidence = results.querySelector(".evidence");
    if (!evidence || evidence.querySelector(".evidence-explorer")) return;
    const originalSymptoms = recognizedSymptoms(
      [...results.querySelectorAll(".signal-list li")].map(item => item.textContent)
    );
    const original = scoreSymptoms(ClueEngine, originalSymptoms);
    if (!original.length) return;

    const panel = create("details", "", "evidence-explorer");
    panel.append(
      create("summary", "What-if evidence explorer"),
      create("p", "Choose symptoms to see how article similarity changes in this educational exercise. Use the review above for care guidance.")
    );

    const field = create("fieldset");
    const choices = create("div", "", "explorer-choices");
    field.append(create("legend", "Symptoms in the what-if"), choices);
    const controls = indexedSymptoms.map(symptom => {
      const label = create("label");
      const checkbox = create("input");
      checkbox.type = "checkbox";
      checkbox.value = symptom;
      checkbox.checked = originalSymptoms.includes(symptom);
      label.append(checkbox, create("span", symptom));
      choices.append(label);
      return checkbox;
    });
    const reset = create("button", "Restore original symptoms", "secondary explorer-reset");
    reset.type = "button";

    const table = create("table");
    table.setAttribute("aria-live", "off");
    table.append(create("caption", "Article similarity"));
    const headings = create("tr");
    for (const title of ["Source article", "Original", "What-if"]) {
      const cell = create("th", title);
      cell.scope = "col";
      headings.append(cell);
    }
    const head = create("thead");
    head.append(headings);
    const body = create("tbody");
    table.append(head, body);
    const status = create("p", "", "explorer-status");
    status.setAttribute("role", "status");
    panel.append(field, reset, status, table);

    const update = () => {
      const selected = controls.filter(checkbox => checkbox.checked).map(checkbox => checkbox.value);
      const hypothetical = scoreSymptoms(ClueEngine, selected);
      renderComparison(body, original, hypothetical);
      const unchanged = selected.every((symptom, index) => symptom === originalSymptoms[index])
        && selected.length === originalSymptoms.length;
      if (unchanged) {
        status.textContent = "The original symptoms are selected.";
      } else if (!hypothetical.length) {
        status.textContent = "No article shares at least two of the selected symptoms.";
      } else {
        const count = hypothetical.length;
        status.textContent = count === 1
          ? "One article shares at least two of the selected symptoms."
          : count + " articles share at least two of the selected symptoms.";
      }
    };
    field.addEventListener("change", update);
    reset.addEventListener("click", () => {
      for (const checkbox of controls) checkbox.checked = originalSymptoms.includes(checkbox.value);
      update();
    });

    update();
    evidence.append(panel);
  }

  new MutationObserver(mountExplorer).observe(results, {childList: true});
  mountExplorer();
})(globalThis);
