# Cluewell

**One-line pitch.** Turn a symptom story into a traceable reading list and a clear next step. See exactly how the answer changes when a warning sign appears.

## The problem

Someone who wakes up sneezing with a sore throat can find several plausible explanations online. A list of conditions alone leaves two questions unanswered. Which details supported each suggestion? Is there something in the story that deserves attention now?

## What we built

Cluewell is an educational prototype for adults in the United States. A visitor can type, dictate a story, or attach an image and review its notes. Cluewell checks for recognized emergency signs before retrieving material from a small set of CDC and NHS articles. Each result links to its source, names the shared symptoms and explains the score. Low overlap has its own outcome. Users can edit the input and compare the result immediately.

## How the AI works

Browser speech recognition transcribes dictation where supported. A local visual classifier reads clean uppercase printed notes by comparing glyphs with generated font examples. General OCR can use Tesseract.js. On compatible devices, Chrome’s multimodal Prompt API can draft a neutral photo caption. The user reviews image notes before they enter the analysis. Text processing maps phrases to distinct symptom concepts, handles common negations and scores the concept vectors against article profiles with cosine similarity. The emergency decision uses explicit rules so a high article score cannot override a recognized warning sign.

## What to show

1. Load **Cold-like symptoms** and select **Review my symptoms**. Read the phrase-level evidence and open the calculation. The three scores can overlap.
2. Clear the form. Load the synthetic image note, extract its text and confirm the transcription. Submit. The same source-ranking process runs on the reviewed image input.
3. Load **Urgent warning sign**. Submit again. The ranked articles give way to an emergency action with the triggering details.
4. Try an unsupported story such as “My wrist clicks when I turn a doorknob.” Cluewell acknowledges that the collection cannot explain it.

## Scope and limitations

The collection covers common cold, seasonal allergies and overlapping flu/COVID-19 symptoms. Scores describe article similarity. No patient dataset, clinical outcome validation or diagnostic probability model was used. The phrase rules can miss or misread a symptom. A trained clinician can consider history, physical examination and tests. Photo captions and transcriptions can be wrong. The app does not diagnose from images, prescribe treatment, or store case histories. Browser speech services may process audio externally.

## Competition context

SLAY HACKS lists a December 7, 2026, 5 p.m. Eastern submission deadline and an age-of-majority student eligibility condition. Its requirements call for a working demo, screenshots, accessible source and accurate team information. The organizer recommends a two-to-four-minute video. Team members should enter their own names and describe their contributions, including AI-assisted development. [Event and requirements](https://slayy-hacks.devpost.com/) · [Official rules](https://slayy-hacks.devpost.com/rules)

## Design and prior work

I could verify three comparable CareTech Winter 2026 winners. The organizer’s gallery credits each project. Their published descriptions informed these demo choices.

| Comparable project | Interaction described by its team | Cluewell design decision |
| --- | --- | --- |
| [Calyx](https://devpost.com/software/calyx-7hnod6) | Turns a wound photograph into measurements for a clinical workflow. | Make the photo’s contribution visible and editable before using it. |
| [MedScribe](https://devpost.com/software/medscribe-lczwdy) | Turns a visit into a plain-language summary for the patient. | Give people an editable record of what the system heard. |
| [MedLeaf](https://devpost.com/software/medleaf-75zu4s) | Explains family health and insurance information in plain English. | Place each explanation beside its supporting source. |

[CareTech winner gallery](https://caretech-hackathon-2026.devpost.com/project-gallery) · [Award announcement](https://caretech-hackathon-2026.devpost.com/updates)

The interface uses an original layout and original procedural artwork. NHS 111 informed the task-first intake, MedlinePlus informed the source navigation, and Superdesign’s design-system prompt informed the spacing, typography and interaction states. [NHS 111](https://111.nhs.uk/) · [MedlinePlus](https://medlineplus.gov/healthtopics.html) · [Superdesign prompt](https://superdesign.dev/blog/chatgpt-design-prompts#2-the-design-system-prompt)

