---
name: grudge-client-law
description: >
  Grudge Studio client law for free asset libraries, API models, the
  grudge-pipeline draft studio, public GitHub, and HeyPuter/everything
  (Puter 3D Studio and sibling apps). Use when a client or agent picks a
  mesh, a model, a pipeline export, a repo, or a 3D modeling tool.
---

# Grudge client law

Extend the live fleet. Do not stand up a second CDN, a second player database,
a second physics world, or a second play hero loader.

| Need | Use |
| --- | --- |
| Play binaries | `https://assets.grudge-studio.com` (R2 `grudge-assets`, worker `grudge-asset-cdn`) |
| Definitions | `https://objectstore.grudge-studio.com/api/v1/` |
| Asset search | D1 index, games filter `purpose=play` |
| Player bag, characters, wallet | Railway Postgres (`grudge-api-production`) |
| Sign-in | `https://id.grudge-studio.com` |
| Models | Legion `https://ai.grudge-studio.com` first |
| Studio canvas | Catsot at `https://builder.grudge-studio.com` |
| Draft 3D | `https://3d.puter.com` then bake to the CDN |

## Free asset libraries

Ship a production mesh only as a single-file `.glb`, or a `.gltf` whose `.bin`
was checked. `HEAD` must be 200, the body must not be HTML, and a GLB must
start with the `glTF` magic. Measure the world box in meters before place.
1 unit = 1 m. A human is about 1.8 m.

Libraries already on the CDN:

- Kenney CC0 kits under `models/kenney/` and `ui/kenney/`. Credit Kenney when a
  kit is CC-BY (Skyrim mods are CC-BY 3.0).
- Kenney RPG and impact audio.
- CraftPix RPG HUD art.
- Duelyst unit sprites (CC0) under `sprites/duelyst/`.
- Play heroes are the Toon RTS race GLBs, loaded by the existing race-kit
  loader, on skeleton `Bip001`, one `AnimationMixer`. Outline packs are look
  reference only.

Gap-fill is search, not the play library. Rocketbox (MIT), USDCraft
(Apache-2.0), and Objaverse (CC0 or CC-BY-4.0 per row) stay `purpose=catalog`.
Pull one web GLB for a named gap, keep the author credit on CC-BY rows, and
measure scale. Do not bulk-mirror them. Do not use them as the play body.

Browser loads go through the app asset helper with `referrerPolicy=no-referrer`.
A raw `assets.grudge-studio.com` URL can 403 when the page Referer is on the
hotlink list.

Do not load KayKit or MegaKit split glTF, do not use emoji as production icons,
and do not add another asset host.

## API models

Call models in this order:

1. Legion at `https://ai.grudge-studio.com`.
2. Puter user-pays (`puter.js`). The signed-in user pays for those tokens.
3. Existing free tiers last, through the studio worker that already has them.

Start at the cheapest model that can do the job. Keys, deployer tokens, and
backup JWTs stay on the server. The browser never sees them.

Do not call `puter.ai.chat` from every page. Do not invent
`api.grudge-studio.com`. Player routes stay on the Railway game API. If
`POST /api/ai/chat` on that API is not mounted, use Legion.

## grudge-pipeline

Repo: https://github.com/MolochDaGod/grudge-pipeline
Live draft studio: https://grudge-pipeline.vercel.app

Use it to browse the public catalog and to render a draft. Its own send-to-game
path is not the play path:

- Meshy output is not a production hero.
- Its rig is Mixamo `mixamorig:*`. Warlords play clips are `Bip001`. Retarget
  before any play use.
- Default scale `0.01` and a capsule collider are not SI meters.
- Its `ai_characters` table is not the player roster. Characters stay on Railway.
- Its client defaults `assets-api.grudge-studio.com` and `api.grudge-studio.com`
  are not the public CDN or the game API. Binaries are
  `https://assets.grudge-studio.com`.

Public catalog browse and an honest import record are fine. Upload a file to R2
only after the `HEAD` and magic-byte checks, and leave `purpose` off `play`
until the skeleton and the meter scale are reviewed. Bake through ObjectStore
`grudge-convert`.

## GitHub for clients

Clients read public repositories only. Pin a commit or a tag. Do not track
floating `main` for anything a player build depends on.

No personal access token, fine-grained token, or private key in the browser,
in a plugin, or in a committed env file. Private repos stay on the server.

`Grudge-Warlords` is the Enterprise org and stays private. `THC-Labz` is the
free org. Do not clone either into the client. This fork stays on
`MolochDaGod/ohmygrudge` unless the owner moves it.

## Puter everything (3D and product drafts)

Repo: https://github.com/HeyPuter/everything
The repository root is MIT. Do not copy the monorepo into this app.

Use the live apps as draft tools:

| Draft | App |
| --- | --- |
| 3D model, UV, sculpt | https://3d.puter.com |
| Photo | https://ps.puter.com |
| Vector | https://ves.puter.com |
| Audio | https://as.puter.com |
| Music | https://ms.puter.com |
| Video | https://vs.puter.com |

`src/3d` (`puter-3d`) is AGPL-3.0-only. Link it and study it. Do not vendor
that source into this networked app. It is a clean-room Three.js modeler. It
is not Blender, and it is not the play runtime. Do not ship its Rapier build
as a second physics world on a play body.

Save private drafts in the user's Puter files. Export GLB, bake with
`grudge-convert`, and publish the binary on `assets.grudge-studio.com`.
Puter files and Puter KV are not the production asset store and not the
player bag.

CAD, parametric, building-design, whiteboard, and document apps in the same
repo are for product drafts. Play meshes still go through the CDN check above.

## Done when

The client can name the host it used, the license it must credit, the commit
it pinned, and why the file is or is not `purpose=play`.
