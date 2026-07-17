# Verification and browser support

## Automated evidence

The recorded final Phase 3 gate passed with 41 unit tests and 24 installed-Chrome Playwright E2E tests. Browser checks covered startup, paint and erase controls, pause/step/clear/recover, Base64 and `.anif` save round trips, autosave restore and corrupt-save handling, drag interpolation, pointer cancellation, CDP pinch/pan without replay painting, keyboard focus traversal, reduced motion, nested-base loading, and scheduler diagnostics.

Chrome coverage includes a `1280 × 800` desktop viewport and a `390 × 844` mobile viewport at device-pixel-ratio 2, including a resize to landscape. This is emulation evidence, not real-device browser certification.

Real iOS Safari and Android Chrome have **not** been verified. The supported runtime policy is modern WebGL browsers; browsers without WebGL display the app's unsupported-renderer state. There is no Canvas fallback.

## Recorded benchmark evidence

The latest clean Chrome run recorded these values:

| Check | Method | Result |
| --- | --- | --- |
| Simulation tick | 50%-occupied deterministic fixture; 60 warm-up ticks, then 300 timed ticks | p95 1.5 ms; max 1.7 ms |
| Renderer update | 10 warm-up renders, then 120 full-texture renders | p95 2.4 ms; max 2.9 ms |
| Scheduler | Normal and interactive 10-second browser runs | Strict: 0 catch-up-cap hits; 0 dropped ticks |

The test budget for the first two checks is p95 under 16.7 ms and maximum under 33.3 ms. These are host- and Chrome-dependent measurements, not universal performance guarantees.

“Renderer update” measures JavaScript CPU time to convert the full material buffer to RGBA and submit `source.update()` to Pixi/WebGL. It does **not** measure GPU completion, compositing, display presentation, or end-to-end frame latency.

## Long-task limitation

The interactive 10-second Chrome run recorded six Long Task entries, with a maximum duration of 189 ms. Chrome does not provide reliable same-page attribution for those entries, so this evidence cannot identify them as application work or as an application regression. The run still had strict zero catch-up-cap hits and zero dropped ticks. Treat the long-task count as an observed limitation of the evidence, not an attributed performance result.

## Deployment smoke

The Chrome suite built and served the application from a nested Vite base path and loaded it at `/nested/`. See the [README deployment instructions](../README.md#static-deployment) for the corresponding build command.
