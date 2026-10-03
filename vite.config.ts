import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import { accountsDev } from './server/accountsDev.ts'
import { coachApi } from './server/coachApi.ts'
import { lanGuard } from './server/lanGuard.ts'
import { offlineSw } from './server/offlineSw.ts'
import { dbApi } from './server/dbApi.ts'
import { puzzleApi } from './server/puzzleApi.ts'

// the root data/ folder holds the downloaded games and built databases (not src/data, which is app content)
const dataDir = fileURLToPath(new URL('./data', import.meta.url))

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // loadEnv with '' prefix reads ANTHROPIC_API_KEY from .env.local for the server only (never bundled)
  plugins: [
    lanGuard(process.env.CC_LAN_TOKEN),
    react(),
    coachApi(loadEnv(mode, process.cwd(), '')),
    dbApi(),
    puzzleApi(),
    accountsDev(),
    offlineSw(process.env.VITE_STATIC_HOST === '1'), // hosted build only: works offline
  ],
  // the on-device database runs SQLite (WebAssembly) in a module worker
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['@sqlite.org/sqlite-wasm'] },
  // database builds write into data/; don't reload the page when they change
  server: { watch: { ignored: [`${dataDir}/**`] } },
}))
