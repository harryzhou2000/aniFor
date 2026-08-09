# Visual Lab accepted evidence

`accepted-v1/` is the portable accepted package for the four frozen Visual Lab
recipes. Its manifest identity covers only catalog-ordered candidate/result
records; provenance is deliberately external to that identity.

The current package was visually accepted from a fresh local SwiftShader review
of source revision `627ef5070ffd4628356ba5b27cefbf6554ecae08`. All four release
recipes passed with WebGL/HDR, zero browser errors, and the audit-only
`hermetic-918x576-v1` geometry proof. The old 749×469 package compared as four
expected dimension-mismatch review items; the reviewed promotion
`sha256:261fdf5d7b6b2ce358e193a30b55498b3c7597a5a0db11bf40309ad3f9d868f2`
then compared four-for-four encoded-identical against its capture source. The
accepted manifest ID is
`sha256:b78ac28395d454a13889b2124fa4364119463756407877ab801608a783eba1aa`.
Workflow run `31333870677` subsequently captured the exact deployed
`3f8a4235d220fd2d3ec62d04b1d84c10897ea67f` artifact and matched all four
result IDs plus all twelve accepted PNG hashes byte-for-byte before Pages and
live-origin verification completed.

The additive `accepted-v1/capture-provenance.json` was regenerated from that
original reviewed source. Regeneration produced the exact existing baseline ID
and byte-identical `index.json` plus twelve PNGs; the sidecar is the only added
file. Provenance ID
`sha256:0a7dfe433b4b878c67812e116513c0647affff53c97a7e7905505d271af067f8`
binds the baseline and ordered result IDs to `hermetic-918x576-v1`. Release
verification must use `--require-baseline-capture-provenance=1`.

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

For the ordinary local edit-to-review loop, use the developer launcher. It
requires an explicit selection, allocates a unique ignored output root, and
prints direct static review links after provenance-required verification:

```sh
npm run visual-lab:review -- --candidate=water-motion
npm run visual-lab:review -- \
  --recipe-set=visual-lab/recipe-sets/liquid-motion.json
```

When `dist/index.html` is already current, use `visual-lab:review:reuse` to omit
the rebuild. The lower-level `audit:visual-lab:review` command remains available
when CI or a diagnostic script must choose the output directory and capture
options explicitly. Neither command opens the board, scores a variant, promotes
a baseline, or mutates Git.

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
measurements, not scoring, acceptance, failure, or promotion input.
`review-board.html` adds a bounded local status/domain/fixture/name filter over
the decision candidates without changing their catalog order or recording a
decision. All three additive files change no comparison field or identity and
are checked by the same portable verifier when present; it recomputes metrics
from the pinned PNG bytes and exact-rerenders the board. Legacy comparison
packages may omit the board, metrics, and/or brief.

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
brief/board/metrics evidence, and cross-package descriptors, and does not change
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
