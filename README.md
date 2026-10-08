# AI-Based Dynamic Questionnaire System

A web-based system that assembles **dynamic, culturally aware questionnaires**
adapted to each respondent in real time. The system infers a respondent's cultural
profile from a short set of initial questions, assembles a questionnaire from items
drawn from validated scales and matched to that profile, and monitors response-time
behavior to detect fatigue, dynamically adjusting the number and length of the
questions presented.

This repository accompanies the study *"Designing an AI-Based System for Generating
Dynamic Questionnaires in Multicultural Environments: Evaluating User Interaction and
Response Behavior"* (case study: perceived stress and social support), and contains the
exact implementation used to collect the study data.

> **Note on the term "AI".** In this implementation, item generation is driven by
> rule-based cultural adaptation over curated item banks (see
> [`ARCHITECTURE.md`](ARCHITECTURE.md)), not by a live large-language-model
> API. There are no external API calls or API keys in the code. This is described
> accurately in the accompanying paper.

---

## What the system does

1. The respondent registers and answers a few initial questions (username, requested
   number of items, country, age, and four Hofstede-style cultural items).
2. A **cultural profile** is inferred (power distance, individualism, uncertainty
   avoidance → a master `collectivist` / `individualist` orientation).
3. A **dynamic loop** begins. Each iteration:
   - selects the next item (alternating stress / support), drawn from the item bank
     matching the respondent's orientation, avoiding repeats;
   - records the response and its timing;
   - updates the **fatigue** estimate;
   - decides whether to continue, shorten, or stop.
4. On termination, the system computes stress and support scores and produces
   downloadable PDF reports.

Because the system is adaptive and behavior-aware, **both the content and the number
of items differ from one respondent to another**.

---

## Repository structure

```
ai-dynamic-questionnaire/
├── README.md             ← you are here
├── LICENSE               ← MIT license for this project's own code
├── CITATION.cff          ← how to cite this software
├── index.html            ← the complete, runnable system (single self-contained file)
├── core-logic.js         ← readable, annotated reference of the four core components
├── ARCHITECTURE.md       ← the four-component architecture and the processing pipeline
└── BACKEND.md            ← notes on the optional /api/send-report email endpoint
```

- **`index.html`** is the actual artifact: a single, self-contained HTML file
  (React + precompiled Tailwind CSS + an embedded PDF library). Open it in a browser
  and the system runs.
- **`core-logic.js`** is *not* a separate runtime. It is a clean, commented
  extraction of the scientific logic embedded in `index.html`, provided so that
  reviewers and researchers can read the cultural-profiling, fatigue-detection, and
  question-generation logic without wading through the bundled file. If you change the
  logic, change it in `index.html` (the source of truth) and mirror it here.

---

## How to run

### Quick look (no email delivery)

Open `index.html` directly in a modern browser. The full questionnaire flow works,
and PDF reports can be downloaded. Automatic email delivery of reports is **disabled**
when the file is opened via `file://` (browsers cannot send email on their own).

### Full run with report email delivery

The app posts each generated PDF report to a same-origin backend endpoint
(`/api/send-report`). To enable this, serve `index.html` from a small web server
that also exposes that endpoint. See [`BACKEND.md`](BACKEND.md) for
what the endpoint must accept and how to configure the recipient address.

---

## Reproducibility

- The file `index.html` is the version used to administer the AI-based dynamic
  questionnaire in the study. **Before archiving, confirm this is byte-for-byte the
  version used for data collection**, and record the archive DOI (see below).
- Key fixed parameters as implemented:
  - Requested items are bounded to **15–25** (default 20).
  - **Soft stop:** the questionnaire ends early if the fatigue score exceeds 7 and at
    least 10 items have been collected.
  - **Hard stop:** the questionnaire ends if four consecutive responses are each under
    1 second, or each over 20 seconds.
- The static 22-item comparison instrument (PSS + MSPSS) and the four fixed
  cultural-appropriateness items are described in the paper's appendices.

---

## Data availability

This repository contains **code only**. Participant-level data are **not** included
here. Perceived-stress and social-support responses, together with cultural and
demographic attributes, are sensitive; their sharing is governed by the study's
informed-consent terms, under which participants were assured of confidentiality and
anonymization. Participant-level data are therefore available from the corresponding
author on reasonable request rather than being openly posted.

---

## How to cite

See [`CITATION.cff`](CITATION.cff). After archiving a release on Zenodo, add the
resulting DOI to that file and to the paper's code-availability statement.

---

## License

This project's own code is released under the MIT License (see [`LICENSE`](LICENSE)).
Third-party libraries bundled inside `index.html` (e.g. the PDF-generation library)
retain their own licenses.
