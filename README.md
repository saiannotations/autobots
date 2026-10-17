<<<<<<< HEAD
# RoboFarm — a living robot farm

A self-running 3D farm simulation built with **React**, **React Three Fiber**, **three.js** and **postprocessing**.
Robots plant, harvest, fish and sell to shoppers on their own. A built-in manager reinvests the money in
new bots and upgrades. You just watch.

## Run it

You need **Node.js 18 or newer** (https://nodejs.org).

```bash
cd autobots
npm install
npm run dev        # opens http://localhost:5173
```

For a production build:

```bash
npm run build
npm run preview    # serves the built site on http://localhost:4173
```

## It keeps running

- The farm saves itself to the browser every 5 seconds and when the tab closes.
- When you come back (a refresh, a closed tab, a night away), it fast-forwards the time you missed:
  the first 20 in-game minutes are simulated in full detail, longer gaps are estimated from the farm's
  recent earning rate, and the manager keeps buying bots and upgrades along the way.
  A card tells you what happened while you were away.
- A background tab is caught up the same way when you return to it.
- Nothing resets on its own. **Start over** (tap twice) wipes the save.

The save lives in this browser only (localStorage). A different browser or computer starts its own farm.

## The world

| | |
|---|---|
| Day length | 10 real minutes at 1× (05:30 → 05:30). Night passes faster than daytime. |
| Seasons | Auto rotates one season per day: Spring → Summer → Rainy → Winter. Or pin one. |
| Spring | Strong wind, petals and leaves blowing, blossoming trees, fast windmill |
| Summer | Low warm sun, heat haze over the fields, floating dust, straw hats and sunglasses |
| Rainy | Overcast sky, 3D rain streaks, wet shiny ground with puddles, lightning, umbrellas and raincoats |
| Winter | Snowfall that builds up on every surface, frozen pond with ice fishing, sweaters, scarves, bobble hats |
| Night | Stars, moon, lamp-lit plaza, string lights, robot headlights, fireflies, moths around lamps |

Fireflies appear on spring, summer and (fewer) rainy nights. Winter nights have none, as in real life.

## Controls

| | |
|---|---|
| Drag / scroll | Orbit and zoom (switches to the free camera) |
| W A S D / arrows | Move the free camera |
| Click a robot | Follow it |
| C | Toggle cinematic camera |
| H | Hide / show the interface |
| Esc | Back to the cinematic camera |

## Smooth on any machine

- Graphics quality adapts on the fly (resolution and shadow detail) to hold the frame rate.
- Phones and low-core machines start at a lighter setting (fewer grass blades, no ambient occlusion).
- All weather, fireflies, grass and tree sway run on the GPU; the simulation never re-renders React.
- Textures are generated in a Web Worker so loading never freezes the page.

## Project layout

```
src/
  sim/        simulation engine (no rendering): world.ts, constants.ts, instance.ts (save + catch-up)
  gfx/        procedural PBR textures (texgen.ts + worker) and shader-patched materials
  scene/      3D: Atmosphere (sky, sun, fog, IBL), Landscape, Buildings + Pond, Crops, Bots,
              People, Weather (rain/snow/leaves/fireflies), Fx, CameraDirector, Effects (post)
  ui/         HUD (React) and the zustand store
```

Add `?debug` to the URL to expose `window.__farm` (the simulation) in the console.
=======
# autobots
>>>>>>> 5f6872b05c3bc1caf1d66da8f47cb17c18e91a15
