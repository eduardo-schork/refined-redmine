/**
 * Redmine API keys and GitHub tokens are made of letters, digits and "_". Anything else (a line break or space
 * pasted by mistake) is refused before use: an invalid header value makes the network layer throw an error whose
 * message contains the value itself.
 */
export const isWellFormedSecret = (value: string) => /^[A-Za-z0-9_]+$/.test(value)

/** Removes a secret from a message before it is shown or kept. */
export function redactSecret(message: string, secret: string | undefined): string {
    if (!secret) return message
    return message.split(secret).join('•••')
}
