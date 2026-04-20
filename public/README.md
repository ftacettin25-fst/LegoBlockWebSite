# Grids2Bricks — Static Frontend (Flask + Render)

This `public/` folder is a drop-in static frontend for your existing Flask server.
No build step, no React, no Vite. Just HTML/CSS/JS files.

## File map

```
public/
  index.html              Landing page
  create.html             BrickHeadz creator + staged build overlay
  order.html              Order status + cart
  account.html            Sign in / sign up / Google / signed-in view
  assets/css/             Design system
  assets/js/              Page logic (ESM modules)
    firebase-init.js      ⚠️ EDIT: paste your Firebase web config here
    auth.js               Auth wrapper (email/password, Google, reset)
    nav.js                Shared navbar + cart badge + reveal + toast
    create.js             Upload, validate, staged overlay, /api/create call
    order.js              Cart + order status timeline
    account.js            Auth UI for /account
    ldr-viewer.js         Original Three.js viewer + PDF build guide (preserved)
```

## Wiring it into your Flask server

In `server.py`, point `DIST_DIR` at this folder:

```python
DIST_DIR = os.path.join(SCRIPT_DIR, "public")
```

Your existing routes (`/api/create`, `/api/download/...`, `/api/ldr/...`,
`/api/download-cache/...`, `/api/ldr-cache/...`) continue to work unchanged.
The frontend uses **only** these endpoints. No backend changes are required.

## Firebase setup (auth)

1. In **Firebase Console → Project settings → Your apps → Web**, copy the
   web config snippet.
2. Open `public/assets/js/firebase-init.js` and replace the placeholders in
   `firebaseConfig` with your real values. They are public keys — safe to commit.
3. In **Firebase Console → Authentication → Sign-in method**, enable
   **Email/Password** and **Google**.
4. In **Authentication → Settings → Authorized domains**, add your Render
   domain (e.g. `grids2bricks.onrender.com`) and `localhost`.

That's it — sign in / sign up / Google / password reset all work client-side.

## Notes

- All emojis from the previous design have been replaced with Lucide line icons.
- The "Build my BrickHeadz" button shows a staged overlay (5 stages). Stages
  advance on a realistic timeline while the real `POST /api/create` request is
  in flight; the final stage only completes after the server responds.
- Cart is stored in `localStorage` under the key `g2b_cart`.
- Order status currently shows a deterministic mock timeline based on the
  entered ID. Wire `/api/order/<id>` on the backend later if you want real data
  — only `public/assets/js/order.js > lookupOrder()` needs to change.
