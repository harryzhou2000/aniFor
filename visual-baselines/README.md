# Historical Visual Lab evidence

`accepted-v1/` contains an earlier reviewed package. It remains available for optional comparison. The ordinary Visual Lab review uses current captures and a current review board; a historical image match is not its visual acceptance criterion.

```sh
npm run visual-lab:review -- --candidate=water-motion
npm run audit:visual-lab:baseline:compare -- \
  --baseline-root=visual-baselines/accepted-v1 \
  --result-root=/path/to/complete-batch \
  --output-dir=/path/to/new-comparison
```

The previous package provenance and command details remain in Git history.
