import { readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Newest mtime anywhere under a directory.
 *
 * Stamping only the entry file is not enough, and fails in a way that wastes
 * ten minutes: editing api/_lib/photo.js leaves model.js untouched, so the
 * import URL doesn't change, so Node serves the whole cached module graph and
 * the endpoint reports an export that plainly exists in the file you are
 * looking at.
 */
function newestMtime(dir) {
  let newest = 0
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`
    const at = entry.isDirectory() ? newestMtime(path) : statSync(path).mtimeMs
    if (at > newest) newest = at
  }
  return newest
}

/**
 * Serve api/model.js from the dev server.
 *
 * Without this, /api/ only exists once the app is deployed: `vite dev` answers
 * every unknown path with index.html, so the model endpoint returns a page of
 * HTML and the client can only conclude that generation is switched off. That
 * is a miserable way to work on the one feature that needs a server.
 *
 * The adapter is thin because Vercel's Node handler signature is nearly the
 * Connect one already — query parsing and `res.status().json()` are the whole
 * difference.
 */
function modelApi(env) {
  return {
    name: 'nested-model-api',
    configureServer(server) {
      for (const endpoint of ['model', 'product']) {
      server.middlewares.use(`/api/${endpoint}`, async (req, res) => {
        try {
          // Re-import when anything under api/ changes, so editing the endpoint
          // or its helpers doesn't mean restarting the dev server. Node caches
          // ES modules by URL, and the mtime is what makes the URL new.
          const path = new URL(`./api/${endpoint}.js`, import.meta.url)
          // fileURLToPath, not .pathname — the project lives under a directory
          // with a space in it, and .pathname hands back the %20 undecoded.
          const stamp = newestMtime(fileURLToPath(new URL('./api', import.meta.url)))
          const { default: handler } = await import(`${path.href}?v=${stamp}`)

          const url = new URL(req.url || '/', 'http://localhost')
          await handler(
            { method: req.method, query: Object.fromEntries(url.searchParams) },
            {
              setHeader: (k, v) => res.setHeader(k, v),
              status(code) {
                res.statusCode = code
                return this
              },
              json(body) {
                res.setHeader('Content-Type', 'application/json; charset=utf-8')
                res.end(JSON.stringify(body))
              },
            }
          )
        } catch (err) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ status: 'failed', reason: String(err?.message || err) }))
        }
      })
      }
    },
    config() {
      // The endpoint reads its keys off process.env, the way it will in
      // production. Vite only exposes VITE_-prefixed variables to the client,
      // and these must never reach it.
      for (const [k, v] of Object.entries(env)) {
        if (!k.startsWith('VITE_') && process.env[k] === undefined) process.env[k] = v
      }
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), modelApi(loadEnv(mode, process.cwd(), ''))],
  server: {
    port: 5173,
    open: true,
  },
  build: {
    rollupOptions: {
      output: {
        // Three.js is ~80% of the bundle and isn't needed until the 3D view
        // mounts. Splitting it lets the onboarding survey paint immediately and
        // keeps the big chunk cached across deploys that only touch app code.
        manualChunks: {
          three: ['three'],
          react: ['react', 'react-dom'],
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
}))
