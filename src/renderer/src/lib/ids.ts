// Local UI ids (drafts, board columns). The definitive entity id comes from the main process.
const randomChars = (length: number) =>
    Math.random()
        .toString(36)
        .slice(2, 2 + length)

export const localId = () => randomChars(8) + randomChars(4)
