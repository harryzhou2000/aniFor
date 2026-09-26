# Viewport and rendering notes

The simulation world is 612×384 cells. The viewport applies one uniform fit and zoom scale with CSS-pixel pan. Canvas and WebGL backing resolution is a separate presentation setting; the usual scale is 2×, and the available detail settings are 1×, 2×, 4×, and 8×.

Pointer positions are mapped from the displayed canvas rectangle into world coordinates. The current WebGL field shader uses sprite-local `vFieldCoord` for its semantic texture. An earlier use of Pixi's pooled-filter `vTextureCoord` stretched the visible field while pointer coordinates stayed correct. The old failure looked like a cursor error that grew toward the right and bottom edges.

Visual Lab's audit-only layout uses a fixed 1280×600 CSS viewport and a 918×576 canvas rectangle at (181,12). Ordinary pages use responsive layout.

Focused browser checks are available as `npm run audit:viewport:desktop`, `audit:viewport:mobile`, `audit:viewport:live-scale`, and `audit:viewport:matrix`. The combined audit is `npm run audit:browser-input`. These are tools for investigating relevant changes, not a standing checklist.
