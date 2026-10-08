# Architecture

The system is organized around **four components** and a single administration loop.
The scientific logic lives in `index.html`; a readable extraction is provided in
`core-logic.js`.

## Processing pipeline

1. **Registration & initial questions** — the respondent provides a username, the
   number of items they wish to answer (15–25), country, age, and answers four
   Hofstede-style cultural items.
2. **Cultural inference** — a cultural profile is computed.
3. **Dynamic loop** — each iteration generates an item, records the answer and its
   timing, updates the fatigue estimate, and decides whether to continue or stop.
4. **Termination & outputs** — stress and support scores are computed and PDF reports
   are produced.

---

## 1. Cultural-profiling component

Infers the respondent's cultural orientation from a small set of initial questions,
following Hofstede's dimensions (VSM 2013–inspired).

- Derives numeric scores for **power distance**, **individualism**, and **uncertainty
  avoidance** from the initial items.
- Converts each into a categorical `high` / `low` indicator.
- Derives a single **master orientation** — `individualist` or `collectivist` — which
  drives adaptation of every generated item.
- Records the requested number of items, bounded to **15–25**.

Categorization into `high`/`low` and a binary orientation is a modeling simplification
for computational tractability; it does not imply that cultural dimensions are
inherently discrete. This is stated as a limitation in the paper.

## 2. Fatigue-detection component

Monitors response-time behavior and decides when to shorten or stop.

- Maintains the running mean of all response times and the mean of the **last three**.
- Increments a graded `fatigueScore` (capped at 10) when:
  - the recent average exceeds 1.5× the overall average (slowing down);
  - a single response is implausibly fast (< 2 s);
  - more than 10 items have already been answered.
- **Soft stop:** ends the questionnaire once `fatigueScore > 7` and at least 10 items
  have been collected.
- **Hard stop (extreme pace):** ends the questionnaire if the last four responses were
  each **< 1 s** (careless speeding) or each **> 20 s** (disengagement/confusion).

The mechanism is heuristic and threshold-based rather than physiological; the specific
thresholds are particular to this implementation.

## 3. Question-generation component

Produces, reformulates, and sequences culturally appropriate items.

- On initialization, builds two item banks — **stress** and **social support** — each
  split into a `collectivist` and an `individualist` set.
  - Stress items are adapted from the **PSS** and the **DASS-21** stress subscale.
  - Support items are adapted from the **MSPSS**.
- For each new item, it **alternates** stress / support by question parity, selects
  from the bank matching the respondent's orientation, and avoids repeating any item
  already asked.
- If a bank is exhausted, it constructs a reframed variation of an existing item
  (prefixed, e.g., with *"Thinking about the past month: …"*) so administration can
  continue without literal repetition.
- Each item is annotated with its source scale and the cultural adaptation applied.

## 4. Orchestration component

Coordinates the other three and drives the loop from registration to final reports.
After each answer it evaluates, in order: the extreme-pace hard stop, the fatigue soft
stop, and whether the requested item count has been reached — otherwise it requests the
next item.

---

## Outputs

On termination the system computes average stress and support scores from the recorded
answer indices, flags whether fatigue was detected (`fatigueScore > 5` for reporting),
and generates downloadable PDF reports. A set of four fixed cultural-appropriateness
items is administered at the end (identical across conditions) to support the
static-vs-dynamic comparison in the study.
