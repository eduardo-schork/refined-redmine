import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

/**
 * JSON file with in-memory cache and atomic writes (writes to a .tmp and renames it).
 * A corrupted file is preserved as `<file>.corrupted-<timestamp>` and the content restarts from the defaults.
 */
export class JsonFile<T extends object> {
    private data: T | null = null

    constructor(
        private readonly path: string,
        private readonly defaults: () => T
    ) {}

    read(): T {
        if (!this.data) this.data = this.load()
        return this.data
    }

    private load(): T {
        if (!existsSync(this.path)) return this.defaults()
        try {
            const stored = JSON.parse(readFileSync(this.path, 'utf8'))
            return { ...this.defaults(), ...stored }
        } catch {
            renameSync(this.path, `${this.path}.corrupted-${Date.now()}`)
            return this.defaults()
        }
    }

    write(next: T): void {
        this.data = next
        const directory = dirname(this.path)
        if (!existsSync(directory)) mkdirSync(directory, { recursive: true })
        const tempPath = `${this.path}.tmp`
        writeFileSync(tempPath, JSON.stringify(next, null, 2))
        renameSync(tempPath, this.path)
    }

    update(transform: (current: T) => T): T {
        const next = transform(this.read())
        this.write(next)
        return next
    }
}
