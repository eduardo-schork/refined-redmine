import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const layers = {
    '@domain': resolve('src/domain'),
    '@application': resolve('src/application'),
    '@infra': resolve('src/infra'),
    '@contracts': resolve('src/contracts'),
    '@shared': resolve('src/shared')
}

export default defineConfig({
    main: {
        resolve: { alias: layers }
    },
    preload: {
        resolve: { alias: layers }
    },
    renderer: {
        resolve: {
            alias: { ...layers, '@': resolve('src/renderer/src') }
        },
        plugins: [react(), tailwindcss()]
    }
})
