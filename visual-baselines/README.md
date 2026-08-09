# Visual Lab accepted evidence

`accepted-v1/` is the portable accepted package for the four frozen Visual Lab
recipes. Its manifest identity covers only catalog-ordered candidate/result
records; provenance is deliberately external to that identity.

The current package was accepted from revision
`34c8a3db2dbcf0d497524aac15f0055984faf999`, workflow run `31284862276`, with
manifest ID
`sha256:b95e09ecb1df93c2b9ae718d205159b17dc56379723f2d1ad904458e16c5653c`.

Compare a complete downloaded batch without rebuilding or launching Chrome:

```sh
npm run audit:visual-lab:baseline:compare -- \
  --baseline-root=visual-baselines/accepted-v1 \
  --result-root=/path/to/complete-batch \
  --output-dir=/path/to/new-empty-comparison
```

To prepare a deliberate replacement, write it to a new empty directory and
review its off/A/B images before replacing the checked package:

```sh
npm run audit:visual-lab:baseline:accept -- \
  --batch-root=/path/to/complete-batch \
  --output-dir=/path/to/new-empty-baseline
```

Changed hashes mean human review is needed; they are not an automatic aesthetic
failure and never auto-promote a baseline. Missing, tampered, unsafe, incomplete,
or request-incompatible evidence is rejected.
