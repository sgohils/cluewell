(function expose(root) {
  "use strict";

  const indexedSymptoms = Object.freeze([
    "runny nose", "nasal congestion", "sneezing", "sore throat",
    "cough", "headache", "body aches", "fever", "chills", "fatigue",
    "vomiting", "diarrhea", "loss of smell", "loss of taste",
    "itchy or watery eyes", "itchy nose or throat"
  ]);
  const scoringExplanation = "Each score is the shared-symptom count divided by the square root of (selected symptoms × symptoms indexed for that article), multiplied by 100 and rounded. The list under a score shows the shared symptoms. An article needs at least two shared symptoms to appear as a match.";

  function recognizedSymptoms(signals) {
    return indexedSymptoms.filter(symptom => signals.includes(symptom));
  }

  function scoreSymptoms(engine, symptoms) {
    const story = recognizedSymptoms(symptoms)
      .map(symptom => "I have " + symptom + ".")
      .join(" ");
    return engine.analyze(story).matches;
  }

  function describeChanges(original, selected) {
    const added = selected.filter(symptom => !original.includes(symptom));
    const removed = original.filter(symptom => !selected.includes(symptom));
    return [added.length && "Added " + added.join(", ") + ".", removed.length && "Removed " + removed.join(", ") + "."]
      .filter(Boolean).join(" ");
  }

  function compareMatches(original, hypothetical) {
    const originalByUrl = new Map(original.map(match => [match.url, match]));
    const hypotheticalByUrl = new Map(hypothetical.map(match => [match.url, match]));
    const urls = new Set([...originalByUrl.keys(), ...hypotheticalByUrl.keys()]);
    return [...urls].map(url => {
      const originalMatch = originalByUrl.get(url) ?? null;
      const hypotheticalMatch = hypotheticalByUrl.get(url) ?? null;
      return {name: (originalMatch ?? hypotheticalMatch).name, url, original: originalMatch, hypothetical: hypotheticalMatch};
    });
  }

  if (typeof module === "object" && module.exports) {
    module.exports = {indexedSymptoms, scoringExplanation, recognizedSymptoms, scoreSymptoms, describeChanges, compareMatches};
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
    const cell = create("td");
    const score = create("span", match ? match.score + "/100" : "Fewer than 2 shared symptoms", "explorer-score");
    cell.append(score);
    if (match) {
      score.classList.add("explorer-score-value");
      const shared = create("ul", "", "explorer-shared");
      for (const symptom of match.matched) shared.append(create("li", symptom));
      cell.append(shared);
    }
    return cell;
  }

  function renderComparison(body, original, hypothetical) {
    const rows = compareMatches(original, hypothetical).map(match => {
      const row = create("tr");
      const name = create("th");
      name.scope = "row";
      const source = create("a", match.name);
      source.href = match.url;
      source.target = "_blank";
      source.rel = "noreferrer";
      const domain = new URL(match.url).hostname.replace(/^www\./, "");
      name.append(source, create("span", domain, "explorer-domain"));
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
      create("p", "Add or remove symptoms to compare article similarity. Your care guidance comes from the original review above."),
      create("p", scoringExplanation, "explorer-method")
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
    table.append(create("caption", "Article similarity and shared symptoms"));
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
      const changes = describeChanges(originalSymptoms, selected);
      if (!changes) {
        status.textContent = "The original symptoms are selected.";
        return;
      }
      const count = hypothetical.length;
      const summary = count === 1
        ? "One article shares at least two of the selected symptoms."
        : (count || "No") + " articles share at least two of the selected symptoms.";
      status.textContent = changes + " " + summary;
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
