# Visual Lab accepted evidence

`accepted-v1/` is the portable accepted package for the four frozen Visual Lab
recipes. Its manifest identity covers only catalog-ordered candidate/result
records; provenance is deliberately external to that identity.

The current package was accepted from revision
`34c8a3db2dbcf0d497524aac15f0055984faf999`, workflow run `31284862276`, with
manifest ID
`sha256:b95e09ecb1df93c2b9ae718d205159b17dc56379723f2d1ad904458e16c5653c`.

## Reusable capture cohorts

Checked-in `anifor.visual-lab.recipe-set/v1` files live under
`visual-lab/recipe-sets/`. They contain a bounded name and a nonempty
catalog-ordered subset of full built-in recipe descriptors; their SHA-256
identity covers canonical `{schema,name,recipes}`. They select existing recipes
only—unknown, duplicated, reordered, stale, extended, ambiguous, oversized, or
symlinked input is rejected before a batch output is touched.

```sh
npm run audit:visual-lab:recipe-set -- verify \
  --input=visual-lab/recipe-sets/liquid-motion.json

npm run audit:visual-lab:batch:capture -- \
  --recipe-set=visual-lab/recipe-sets/liquid-motion.json \
  --output-dir=/path/to/new-review
```

`--recipe-set` and `--candidates` are mutually exclusive. New batches publish
their normalized request as `recipe-set.json`; default and legacy candidate
runs synthesize deterministic `full-catalog` and `ad-hoc` sets. The sidecar is a
separate schema and is excluded from result, batch, accepted-baseline,
comparison, and promotion identities, so older packages remain valid. Before
using it as evidence, revalidate its ID and require its complete
`{name,...request}` descriptors to match the completed batch results exactly.

Compare a complete downloaded batch without rebuilding or launching Chrome:

```sh
npm run audit:visual-lab:baseline:compare -- \
  --baseline-root=visual-baselines/accepted-v1 \
  --result-root=/path/to/complete-batch \
  --output-dir=/path/to/new-empty-comparison
```

New comparison packages contain two deterministic relative-path views over the
same validated `comparison/v1` record. `index.html` remains the exhaustive
accepted/current contact sheet. `review-brief.html` is the compact human
decision queue: it shows `review`, `added`, and `not-sampled` candidates first,
with their off/A/B pairs and pinned identities, and lists encoded-identical
candidates as no-action. New packages also include `metrics.json` with the
additive `anifor.visual-lab.comparison-metrics/v1` record: deterministic integer
RGB and alpha deltas for non-identical paired captures only. The metrics are
measurements, not scoring, acceptance, failure, or promotion input. Both files
change no comparison field or identity and are checked by the same portable
verifier when present; it recomputes metrics from the pinned PNG bytes. Legacy
comparison packages may omit either additive file.

Verify a downloaded review package and its comparison without rewriting either:

```sh
npm run audit:visual-lab:verify -- \
  --batch-root=/path/to/downloaded-review \
  --baseline-root=visual-baselines/accepted-v1 \
  --recipe-set-source=visual-lab/recipe-sets/release.json \
  --require-complete=1 --require-recipe-set=1
```

The comparison defaults to `<batch-root>/comparison`. Omit
`--recipe-set-source` when no checked cohort should be bound. Legacy complete
batches may omit `recipe-set.json` when `--require-recipe-set=0`; incomplete
diagnostic packages require `--require-complete=0` and are never deployable
evidence. Verification uses stable non-following reads, reconstructs identities,
bounded PNG structure/decoding and hashes, deterministic HTML, optional
brief/metrics evidence, and cross-package descriptors, and does not change
artifact bytes or metadata. Release CI performs this check on a fresh download
of the exact uploaded artifact in runner-temporary storage before Pages deploy,
without another build or browser capture.

Use `accept` only to seed a new baseline scope from one complete batch. It writes
to a new empty directory and does not merge an existing accepted package:

```sh
npm run audit:visual-lab:baseline:accept -- \
  --batch-root=/path/to/complete-batch \
  --output-dir=/path/to/new-empty-baseline
```

After reviewing a selected or full comparison, promote only the explicitly
accepted current candidates into a complete proposal. The comparison directory
must be the exact portable output produced above; stale JSON, altered image
copies, or a changed sheet is rejected. Candidate input order is normalized to
the frozen catalog, while every unselected accepted record and PNG is preserved:

```sh
npm run audit:visual-lab:baseline:promote -- \
  --baseline-root=visual-baselines/accepted-v1 \
  --result-root=/path/to/complete-selected-batch \
  --comparison-root=/path/to/complete-comparison \
  --candidates=water-motion \
  --output-dir=/path/to/new-empty-baseline-proposal
```

The proposal contains the ordinary content-only `index.json` plus a separately
content-addressed `promotion.json`, excluded from baseline identity, which binds
the previous baseline, exact comparison, selected old/current result IDs, and
proposed baseline ID. The
command never edits the checked package, commits, pushes, deploys, or infers a
visual preference. Inspect the proposal and replace `accepted-v1/` deliberately
through normal version control only after the human decision is final.

Changed hashes mean human review is needed; they are not an automatic aesthetic
failure and never auto-promote a baseline. Missing, tampered, unsafe, incomplete,
or request-incompatible evidence is rejected.
