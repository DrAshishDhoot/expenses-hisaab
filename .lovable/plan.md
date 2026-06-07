## What I found

The published manifest is now the correct one and includes valid 192×192 and 512×512 icons. The remaining install issue is likely not the manifest contents.

The bigger problem is the published service worker: it is generated with precache URLs like:

```text
/client/assets/...
/client/icons/...
/client/manifest.webmanifest
```

But those URLs return 404 on the published site. That means the service worker can fail its install step, so Chrome may not treat the app as fully installable. When Chrome only shows **Add to Home screen**, it often means it sees a website shortcut path, not a fully installable PWA path.

I also found `/manifest.webmanifest` is served as `application/octet-stream`; Chrome often tolerates this, but the correct type is `application/manifest+json` or `application/json`, so we should fix that too.

## Plan

1. **Fix Workbox precache URLs**
   - Update the `VitePWA` config so generated service-worker precache entries are rooted at `/assets/...`, `/icons/...`, and `/manifest.webmanifest` instead of `/client/...`.
   - Keep the service worker filename as `/sw.js`.
   - Keep navigation caching as `NetworkFirst` so app updates and online routes are preferred.

2. **Avoid caching a missing `/index.html` fallback**
   - Remove or adjust the `navigateFallback: "/index.html"` setting because `/index.html` is not served directly on this published TanStack Start app.
   - Keep offline app-shell support via the normal navigation route/runtime cache instead of a missing fallback file.

3. **Serve the manifest with a safer filename/type**
   - Add a `public/manifest.json` copy with the same content.
   - Change the head manifest link from `/manifest.webmanifest` to `/manifest.json`.
   - This usually gets a better JSON content type from hosts and avoids Android Chrome quirks around unknown MIME types.

4. **Keep preview safety**
   - Keep service-worker registration disabled in Lovable preview/dev/iframes.
   - Keep published-site registration only.
   - Keep the `?sw=off` cleanup option.

5. **Post-publish phone reset steps**
   - After publishing the fix, test only on `https://expenses-hisaab.lovable.app`.
   - On phones that already visited the old version: Chrome → Settings → Site settings → `expenses-hisaab.lovable.app` → Clear & reset, then reopen.
   - Wait a few seconds on the first load, pull-to-refresh once, then check Chrome menu. It should show **Install app** instead of only **Add to Home screen** once the corrected service worker installs successfully.