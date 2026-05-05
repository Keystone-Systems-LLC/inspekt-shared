# inspekt-shared

Pure-logic modules shared between the three INSPEKTiT codebases:

- **inspektit-app** (iOS field app, Vite + React + Capacitor) — uses these for in-app preview + review-tab ordering
- **inspekt-web** (web dashboard, Vite + React) — uses these for upload + reorder + lightbox
- **inspekt-web** (Vercel API: `api/report-jobs/generation/`) — uses these for the cloud-generated PDF

This repo exists because we hit a painful drift bug where the iOS file and the cloud copy of the same file silently diverged for 3 days, breaking a live claim's photo report. See the commit log of `inspektit-app` and `inspekt-web` for `cb94d93` (full sync from iOS — interior order, fence overview, detailed building, valley combo, hail_spatter, elevation children).

## Files

| File | What | Consumers |
|---|---|---|
| `photoOrder.js` | `getPhotoSortOrder(section, subsection, context)` + `getEffectiveSortOrder(photo, sortContext)` — canonical photo ordering for the photo report | iOS, web upload/reorder, cloud PDF generator |
| `photoLabelValidation.js` | `validatePhotoDescription(description)` — dev-mode sanity check on auto-generated descriptions | iOS, cloud PDF generator |

## How to use it

Each consumer adds this repo as a git submodule at `shared/`:

```bash
# In inspektit-app:
git submodule add https://github.com/keystonesystem1/inspekt-shared shared
# In inspekt-web:
git submodule add https://github.com/keystonesystem1/inspekt-shared shared
```

Then imports look like:

```js
// iOS Vite (browser):
import { getPhotoSortOrder, getEffectiveSortOrder } from '../../../shared/photoOrder.js'

// inspekt-web Vite (browser):
import { getPhotoSortOrder, getEffectiveSortOrder } from '../../../shared/photoOrder.js'

// inspekt-web Vercel API (Node ESM):
import { getPhotoSortOrder, getEffectiveSortOrder } from '../../../shared/photoOrder.js'
```

## How to make a change

1. Edit the file in this repo (`/Users/andrewowen/inspekt-shared`)
2. Commit + push to `main` here
3. In each consumer repo, bump the submodule pointer:
   ```bash
   cd shared && git pull origin main && cd ..
   git add shared
   git commit -m "chore: bump inspekt-shared to <new-sha>"
   git push
   ```
4. Vercel will redeploy each consumer with the new submodule revision.

## What does NOT belong here

- Anything that imports a Supabase client (use platform-specific wrappers and have them call shared pure functions instead)
- Anything that uses `import.meta.env.*` (Vite-only) or `process.env.*` (Node-only) — pass env state in as a parameter instead
- React components (yet — would require building a shared React build target with platform adapters)
- Anything that does I/O (file system, network, IDB, localStorage)

If you need something that's CLOSE to pure but has one platform leak, refactor the platform leak into an injected parameter and put the rest here.
