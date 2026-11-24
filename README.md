# Cluewell

Cluewell is an educational, US-adult symptom companion built for Slay Hacks. Its central question is “Which details in my story support this guidance?” It retrieves a small set of public-health articles, displays the matched details, and interrupts the reading flow for recognized emergency signs.

## Run

Use Node.js 20 or later. There are no packages to install.

```sh
node server.cjs
```

Open http://127.0.0.1:4173. Run `node --test tests/*.test.cjs` with Node 22 or later for the regression suite. The files in `dist/` can also be deployed to a static web host. Use HTTPS or localhost for microphone access.

## Reproduce the demo

Load **Cold-like symptoms** and select **Review my symptoms**. Inspect the shared details in the three article cards and expand the scoring explanation. Replace the story with **Urgent warning sign**, submit, and inspect the emergency action and the phrases that triggered it.

To exercise the image path, choose **Try an image note** or attach `dist/sample-note.png`. Select **Extract text**, review the words, confirm the notes, and submit. Use a different, clear note in uppercase monospace print to test the bundled recognizer on new input. The downloadable standalone edition embeds its sample image.

## Capabilities

| Component | How it works |
| --- | --- |
| Written story | English phrase normalization, limited negation handling and distinct symptom concepts |
| Article ranking | Cosine similarity against three hand-indexed article profiles, requiring at least two shared concepts |
| Care guidance | Explicit rules for recognized warning signs, disclosed risk, low evidence and follow-up |
| Speech | User-initiated Web Speech recognition on supported browsers. The browser’s speech provider may receive audio |
| Image notes | Local photo preview, manual description and explicit confirmation. Printed-note OCR uses local glyph templates first, then supported native text recognition or a downloaded English Tesseract.js reader |
| Photo caption | Optional browser-provided on-device vision model through Chrome’s Prompt API, subject to device and model availability |

Case data lives in page memory. Reloading or clearing the entry removes it. Tesseract.js and its OCR assets require internet access on first use if the bundled recognizer cannot read the note. External health references open only when selected.

The demo uses synthetic inputs. This prototype has no clinical validation, provides no disease-probability estimate, and may miss or misinterpret warning signs. See [the submission draft](SUBMISSION.md) for scope, source attribution and design references.
