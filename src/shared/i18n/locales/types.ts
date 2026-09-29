import type { ptBR } from './pt-BR'

type DeepString<Shape> = { [Key in keyof Shape]: Shape[Key] extends string ? string : DeepString<Shape[Key]> }

/** Every language must have exactly the same keys as pt-BR. */
export type Resources = DeepString<typeof ptBR>
