import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
    resolve: {
        alias: {
            '@domain': resolve('src/domain'),
            '@application': resolve('src/application'),
            '@infra': resolve('src/infra'),
            '@contracts': resolve('src/contracts'),
            '@shared': resolve('src/shared')
        }
    },
    test: {
        include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'],
        environment: 'node',
        // Date rules use local time; the time zone is pinned so tests are deterministic.
        env: { TZ: 'America/Sao_Paulo' }
    }
})
