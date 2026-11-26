# Build a Grudge

Grudge Studio's client app. It replaces the Puter "Grudge Forge" draft.

Live: https://build-a-grudge.vercel.app

Sign in is Grudge ID (`id.grudge-studio.com`, `app=build-a-grudge`). ALE speaks on this page. Keys and the model workers stay on `grok-builder-agent`. Games you can play here are the authored starters, run in a sandboxed frame. The 3D world, deploy, and publish stay at https://builder.grudge-studio.com.

`build.grudge-studio.com` is assigned to this Vercel project. DNS still needs one Cloudflare record, proxy off: `CNAME build b0c9352dbdc9db3e.vercel-dns-016.com`. Until that record exists, sign-in return works on `*.grudge-studio.com` and `*.github.io`, and the Vercel host is not on the Grudge ID return list.

Player bags are not stored here.
