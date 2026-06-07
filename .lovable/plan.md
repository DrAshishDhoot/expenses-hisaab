## Why Install isn't showing up

I checked what your phone actually receives from `https://expenses-hisaab.lovable.app`:

- `/sw.js` → served correctly, has a fetch handler ✅
- `/icons/icon-192.png` and `/icons/icon-512.png` → served correctly ✅
- `/manifest.webmanifest` → **wrong file is being served** ❌

The published site is serving this manifest:

```json
{"name":"tanstack_start_ts","short_name":"tanstack_start_ts","start_url":"/","display":"standalone","background_color":"#ffffff","theme_color":"#42b883","lang":"en","scope":"/"}
```

That is NOT your `public/manifest.webmanifest`. It's a default manifest that `vite-plugin-pwa` auto-generates and writes to the build output, overwriting yours. Notice it has **no `icons` array**.

Chrome's installability checklist requires:
- a manifest with `name`, `start_url`, `display: standalone` ✅
- **at least one 192×192 and one 512×512 PNG icon listed in the manifest** ❌ ← missing
- a registered service worker with a fetch handler ✅
- HTTPS ✅

Because the served manifest has no icons, Chrome silently fails the installability check and hides "Install app". That's why it's inconsistent / not appearing.

## The fix

Tell `vite-plugin-pwa` to stop generating its own manifest and use the real one from `public/`.

### Change in `vite.config.ts`

Add a single option to the `VitePWA({...})` call:

```ts
VitePWA({
  registerType: "autoUpdate",
  injectRegister: null,
  filename: "sw.js",
  manifest: false,                 // ← add this; stop the plugin from emitting its own manifest
  devOptions: { enabled: false },
  workbox: { /* unchanged */ },
}),
```

With `manifest: false`, the plugin won't write a `manifest.webmanifest` into the build, so Cloudflare will serve the real one from `public/manifest.webmanifest` (the one with all 3 icons, `#1a1c1d` theme, "Expenses Hisaab" name).

The `<link rel="manifest" href="/manifest.webmanifest">` already in `__root.tsx` keeps working — same path, just now points at the correct file.

### Nothing else changes

- `public/manifest.webmanifest` — already correct, keep as-is
- `public/icons/*` — already correct, keep as-is
- `src/lib/register-sw.ts` — already correct
- Service worker behavior — unchanged

## After publishing

On the phone:
1. Open `https://expenses-hisaab.lovable.app` in Chrome.
2. **Important: hard-refresh once** (pull down to refresh) so Chrome picks up the new manifest and re-runs the installability check.
3. Chrome menu (⋮) → **Install app** / **Add to Home screen** should now appear consistently.

If it still doesn't show on a device that visited the old broken manifest:
- Chrome → Settings → Site settings → expenses-hisaab.lovable.app → **Clear & reset** (this clears the cached bad manifest), then reopen the site.

I'll also briefly explain in the reply why Install is hidden on the `id-preview--…lovable.app` URL by design (service worker is intentionally not registered in the editor preview), so the only place to test installation is the published URL.
