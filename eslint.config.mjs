// @ts-check
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import boundaries from 'eslint-plugin-boundaries'
import reactHooks from 'eslint-plugin-react-hooks'

const elements = [
    { type: 'domain', pattern: 'src/domain/**' },
    { type: 'application', pattern: 'src/application/**' },
    { type: 'infra', pattern: 'src/infra/**' },
    { type: 'contracts', pattern: 'src/contracts/**' },
    { type: 'shared', pattern: 'src/shared/**' },
    { type: 'main', pattern: 'src/main/**' },
    { type: 'preload', pattern: 'src/preload/**' },
    { type: 'r-app', pattern: 'src/renderer/src/app/**' },
    { type: 'r-pages', pattern: 'src/renderer/src/pages/**' },
    { type: 'r-templates', pattern: 'src/renderer/src/ui/templates/**' },
    { type: 'r-organisms', pattern: 'src/renderer/src/ui/organisms/**' },
    { type: 'r-molecules', pattern: 'src/renderer/src/ui/molecules/**' },
    { type: 'r-atoms', pattern: 'src/renderer/src/ui/atoms/**' },
    { type: 'r-hooks', pattern: 'src/renderer/src/hooks/**' },
    { type: 'r-lib', pattern: 'src/renderer/src/lib/**' }
]

const sharedLayers = ['domain', 'contracts', 'shared']

const policy = (from, to) => ({
    from: { element: { type: from } },
    allow: to.map((type) => ({ to: { element: { type } } }))
})

export default tseslint.config(
    { ignores: ['out/**', 'dist/**', 'node_modules/**', 'build/**', 'resources/**', 'scripts/**', '*.config.*'] },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ['src/**/*.{ts,tsx}'],
        plugins: { boundaries, 'react-hooks': reactHooks },
        settings: {
            'boundaries/elements': elements,
            'boundaries/include': ['src/**/*'],
            'import/resolver': {
                typescript: { project: ['tsconfig.node.json', 'tsconfig.web.json'], noWarnOnMultipleProjects: true }
            }
        },
        rules: {
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
            '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'warn',
            'no-nested-ternary': 'error',
            'no-else-return': ['error', { allowElseIf: false }],
            'no-lonely-if': 'error',
            'no-sequences': 'error',
            'max-depth': ['error', 3],
            complexity: ['error', 12],
            'id-length': ['error', { min: 2, exceptions: ['_', 't'], properties: 'never' }],
            'boundaries/dependencies': [
                'error',
                {
                    default: 'disallow',
                    message: 'Forbidden dependency between layers (see "Architecture" in PROJECT.md)',
                    policies: [
                        policy('domain', ['domain']),
                        policy('application', ['domain', 'application']),
                        policy('contracts', ['domain', 'application', 'contracts']),
                        policy('shared', ['domain', 'shared']),
                        policy('infra', ['domain', 'application', 'infra', 'contracts', 'shared']),
                        policy('main', ['main', 'domain', 'application', 'infra', 'contracts', 'shared']),
                        policy('preload', ['preload', 'contracts']),
                        policy('r-lib', ['r-lib', ...sharedLayers]),
                        policy('r-hooks', ['r-hooks', 'r-lib', ...sharedLayers]),
                        policy('r-atoms', ['r-atoms', 'r-lib']),
                        policy('r-molecules', ['r-molecules', 'r-atoms', 'r-lib', ...sharedLayers]),
                        policy('r-organisms', [
                            'r-organisms',
                            'r-molecules',
                            'r-atoms',
                            'r-hooks',
                            'r-lib',
                            ...sharedLayers
                        ]),
                        policy('r-templates', [
                            'r-templates',
                            'r-organisms',
                            'r-molecules',
                            'r-atoms',
                            'r-hooks',
                            'r-lib',
                            ...sharedLayers
                        ]),
                        policy('r-pages', [
                            'r-pages',
                            'r-templates',
                            'r-organisms',
                            'r-molecules',
                            'r-atoms',
                            'r-hooks',
                            'r-lib',
                            ...sharedLayers
                        ]),
                        policy('r-app', [
                            'r-app',
                            'r-pages',
                            'r-templates',
                            'r-organisms',
                            'r-molecules',
                            'r-atoms',
                            'r-hooks',
                            'r-lib',
                            ...sharedLayers
                        ])
                    ]
                }
            ]
        }
    },
    {
        // The domain is pure: no Node, Electron, React or implicit clock.
        files: ['src/domain/**/*.ts'],
        rules: {
            'no-restricted-imports': [
                'error',
                { patterns: ['node:*', 'electron', 'react', 'react-dom', '@tanstack/*', 'i18next', 'react-i18next'] }
            ]
        }
    },
    {
        files: ['src/**/*.test.ts'],
        rules: { '@typescript-eslint/no-non-null-assertion': 'off' }
    }
)
