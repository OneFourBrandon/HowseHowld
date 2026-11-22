/**
 * Slate uses four meanings, one hue each.
 * Moss: done, or in credit. Brass: waiting on someone. Brick: missed, or owed.
 * Steel: scheduled. Iris marks classes, and ink is the neutral.
 */
export type Tone = 'moss' | 'brass' | 'brick' | 'steel' | 'iris' | 'ink'

export const toneClass = (tone?: Tone) => (tone ? `sl-tone-${tone}` : undefined)
