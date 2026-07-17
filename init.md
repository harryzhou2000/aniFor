Given that you're planning to use **state-of-the-art coding agents** (GPT-5.6/Codex-class, Claude, Kimi, Gemini, etc.), I'd actually optimize the project differently than I would for a human-written codebase.

The constraint is no longer "minimize implementation complexity." Instead, it's **maximize architectural clarity and extensibility**. Agents are surprisingly good at implementing well-specified modules, but they're much less reliable when a project lacks clean boundaries.

I'd therefore write the design almost like an RFC.

---

# Project: Powder Toy Reimagined

## Vision

Create a **beautiful, tactile, mobile-first physics sandbox** inspired by Powder Toy.

The goal is **not** to recreate Powder Toy feature-for-feature.

Instead:

> A relaxing, elegant particle playground with modern rendering and intuitive interaction.

Think

> Powder Toy × Monument Valley × Apple demo × Zen sandbox

rather than

> Scientific simulator.

The beauty should come from

* satisfying interactions
* visually pleasing particles
* emergent behavior
* procedural graphics

instead of handcrafted assets.

Everything runs entirely client-side.

---

# Guiding Principles

## 1. Simulation is king

The simulation should remain deterministic.

Rendering must never affect physics.

```
Simulation
    ↓
Renderer
```

never

```
Renderer
    ↓
Simulation
```

---

## 2. Rendering is an interpretation

The simulation only knows

```
Water

Sand

Fire

Smoke
```

It does **not** know

* bloom
* lighting
* transparency
* reflections

Those belong entirely to the renderer.

---

## 3. Minimal content

Avoid adding

* hundreds of particle types
* campaigns
* missions
* progression

Instead maximize

* combinations
* emergent systems
* beautiful interactions

---

## 4. Mobile first

The desktop UI is secondary.

Primary interaction:

* touch
* gestures
* large controls

---

## 5. Static deployment

Everything must work on

* GitHub Pages
* Cloudflare Pages
* Netlify

No backend.

No database.

No accounts.

---

# Architecture

```
HTML

↓

TypeScript

↓

Simulation Interface

↓

Powder Backend (WASM)

↓

Renderer (PixiJS)

↓

GPU
```

Every layer is replaceable.

---

# Backend

## Phase 1

Reuse Powder Toy's simulation engine.

Compile with Emscripten.

```
C++

↓

WebAssembly

↓

JS bindings
```

Only expose a small API.

Example:

```
step()

setParticle()

erase()

loadWorld()

saveWorld()

getDirtyCells()
```

The frontend should know nothing about Powder Toy internals.

---

## Phase 2

Fork and simplify.

Eventually remove

* desktop assumptions
* obsolete particles
* UI coupling

The backend becomes a reusable simulation library.

---

# Renderer

This is the project's identity.

Never reuse Powder Toy rendering.

Instead create a completely new rendering pipeline.

---

## Rendering Philosophy

Particles are **materials**, not pixels.

The renderer asks

> "How should water look?"

not

> "Which color is this cell?"

---

## Technology

PixiJS

Reasons:

* GPU accelerated
* mature
* custom shaders
* excellent batching
* minimal boilerplate
* compatible with static deployment

Avoid

* Three.js
* Babylon

because this is fundamentally not a 3D game.

---

# Rendering Pipeline

Simulation

↓

Extract changed cells

↓

Material renderer

↓

Post-processing

↓

Display

---

## Materials

Each material owns a renderer.

Example:

```
SandRenderer

WaterRenderer

SmokeRenderer

FireRenderer

CrystalRenderer
```

Every renderer is independent.

---

# Visual Style

## Sand

Appearance

* matte ceramic
* slight grain
* random tint variation

Motion

* tiny settling animation
* slight wobble

---

## Water

Appearance

* translucent
* glossy
* rounded

Rendering

* metaball merging
* Fresnel rim
* soft highlights

---

## Smoke

Appearance

* volumetric
* translucent

Rendering

* procedural noise
* fading
* turbulence

---

## Fire

Appearance

* emissive

Rendering

* additive blending
* bloom
* animated brightness

---

## Lava

Appearance

* viscous

Rendering

* glow
* cooling edges
* heat shimmer

---

# 3D-ish Illusion

The renderer never uses actual 3D meshes.

Instead combine

## Soft sprites

Every particle is a tiny sphere.

---

## Normal-map lighting

A directional light illuminates every particle.

Changing light direction changes the entire scene.

---

## Ambient occlusion

Dense piles darken naturally.

---

## Height reconstruction

Optional.

Sand piles derive normals from neighboring occupancy.

Creates convincing shading.

---

## Screen-space effects

Bloom

Heat distortion

Motion blur

Color grading

Glow

---

# Water Rendering

This deserves special treatment.

Instead of rendering particles independently,

construct a smooth density field.

```
Particles

↓

Density

↓

Marching Squares / Metaballs

↓

Smooth surface

↓

Shader
```

This creates liquid-looking water while preserving the cellular simulation.

---

# Simulation Tick

Target

```
60 FPS rendering

30–120 Hz simulation
```

Renderer interpolates between simulation ticks.

Particles appear smooth despite discrete physics.

---

# Performance

Backend

* WASM
* contiguous memory
* no allocations

Renderer

* GPU instancing
* sprite batching
* dirty-region updates

Never upload the entire world if only a small area changed.

---

# User Interaction

Brushes

* tap
* drag
* long press erase

Gestures

* pinch zoom
* two-finger pan

Quick palette

Large circular buttons.

Minimal menus.

---

# Saving

LocalStorage autosave.

Export

Compressed binary

↓

Base64

↓

URL

Users can share worlds without servers.

---

# Future Extensions

Once the core is solid:

* day/night lighting
* weather
* particle sound synthesis
* multiplayer replay files
* scripting
* educational visualization

---

# AI-Friendly Code Organization

This is perhaps the most important decision if agents will write much of the code.

```
packages/

    simulation/
        wasm bridge
        API
        tests

    renderer/
        Pixi
        shaders
        materials

    ui/
        touch
        menus

    app/
        orchestration

    shared/
        types
```

Within the renderer:

```
renderer/

    core/

    materials/

        water/

        sand/

        fire/

        smoke/

    shaders/

    postprocess/

    lighting/
```

Each directory should expose a small, stable interface. An agent can then implement `WaterRenderer`, `BloomPass`, or `TouchController` almost independently, reducing merge conflicts and making parallel development practical.

---

## A philosophical shift from Powder Toy

The one design choice I'd deliberately make is this:

> **Powder Toy is a physics engine with a renderer attached. This project should be a real-time generative art engine powered by physics.**

That sounds subtle, but it changes almost every downstream decision. In Powder Toy, rendering is faithful and utilitarian because the simulation is the product. Here, the simulation is the *instrument* and the visuals are the *experience*. Every rendering decision—soft lighting, material shaders, metaball liquids, bloom, ambient occlusion, smooth interpolation—should enhance the tactile pleasure of interacting with the sandbox, even if it isn't a perfectly literal depiction of the underlying grid.

I also wouldn't be afraid to let the renderer "lie" aesthetically. Water can look smoother than the simulation, fire can glow beyond its occupied cells, and sand can settle with tiny easing animations. As long as the simulation remains deterministic underneath, these perceptual enhancements make the sandbox feel alive without compromising its physics. I think that's the direction that would make this project feel like a modern reinterpretation rather than simply "Powder Toy in a browser."
