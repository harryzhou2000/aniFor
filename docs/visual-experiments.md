# Visual experiments

## Settled earth powder bodies

The canonical normal WebGL compositor now treats a packed, temporally settled
Smooth body of Sand, Stone, Clay, or Concrete as continuous material rather
than independently coloured simulation cells. It retains a bounded mineral
trace, then restores the existing broad mesostrata and body-light layers.

The treatment is RGB-only and uses only already-decoded semantic contact and
stability values. It does not add a texture, field, pass, allocation, or
output-scale resource. Local, Grains, other powder families, alpha, semantic
ownership, authored holes, thin/single-grain controls, and the separate direct
8x shader remain outside the treatment.

Evidence:

- `npm run audit:powder-mesostrata` exercises dense Sand/Stone/Clay/Concrete,
  holes, columns, isolated grains, liquid contact, walls, and Local/Grains
  controls.
- `node scripts/verify-browser-input.mjs --powder-mesostrata-graphics-only
  --webgl-only --production-bundle --screenshot=/tmp/powder.png` captures the
  final styled audit fixture for visual comparison.
- `node scripts/verify-browser-input.mjs --eight-powder-only
  --production-bundle` retains a bounded true-8x startup/timing/powder check;
  the complete `--scale-eight-only` suite remains the publication gate.

