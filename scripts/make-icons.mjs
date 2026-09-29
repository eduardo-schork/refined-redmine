// Generates the app and tray icons as PNG, with no external dependencies.
// Usage: npm run icons
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const BYTES_PER_PIXEL = 4
const BIT_DEPTH = 8
const COLOR_TYPE_RGBA = 6
const FILTER_NONE = 0
const SUPERSAMPLES_PER_AXIS = 4

const crcTable = Array.from({ length: 256 }, (_, tableIndex) => {
    let crc = tableIndex
    for (let bit = 0; bit < 8; bit++) {
        crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
    }
    return crc >>> 0
})

function crc32(bytes) {
    let crc = 0xffffffff
    for (const byte of bytes) {
        crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
    }
    return (crc ^ 0xffffffff) >>> 0
}

function uint32(value) {
    const bytes = Buffer.alloc(4)
    bytes.writeUInt32BE(value)
    return bytes
}

function pngChunk(type, data) {
    const typeAndData = Buffer.concat([Buffer.from(type), data])
    return Buffer.concat([uint32(data.length), typeAndData, uint32(crc32(typeAndData))])
}

function headerChunkData(size) {
    const header = Buffer.alloc(13)
    header.writeUInt32BE(size, 0)
    header.writeUInt32BE(size, 4)
    header[8] = BIT_DEPTH
    header[9] = COLOR_TYPE_RGBA
    return header
}

// Each PNG scanline starts with a filter-type byte before its pixels.
function toScanlines(size, rgba) {
    const rowLength = size * BYTES_PER_PIXEL
    const scanlines = Buffer.alloc((rowLength + 1) * size)
    for (let row = 0; row < size; row++) {
        const scanlineStart = row * (rowLength + 1)
        scanlines[scanlineStart] = FILTER_NONE
        rgba.copy(scanlines, scanlineStart + 1, row * rowLength, (row + 1) * rowLength)
    }
    return scanlines
}

function encodePng(size, rgba) {
    return Buffer.concat([
        PNG_SIGNATURE,
        pngChunk('IHDR', headerChunkData(size)),
        pngChunk('IDAT', deflateSync(toScanlines(size, rgba))),
        pngChunk('IEND', Buffer.alloc(0))
    ])
}

function isInsideRoundedRect(pointX, pointY, rectX, rectY, width, height, radius) {
    const isOutsideBounds = pointX < rectX || pointY < rectY || pointX > rectX + width || pointY > rectY + height
    if (isOutsideBounds) return false
    // Distance to the nearest point of the rectangle shrunk by the radius decides the rounded corners.
    const nearestX = Math.min(Math.max(pointX, rectX + radius), rectX + width - radius)
    const nearestY = Math.min(Math.max(pointY, rectY + radius), rectY + height - radius)
    return (pointX - nearestX) ** 2 + (pointY - nearestY) ** 2 <= radius * radius
}

// Three kanban columns with different heights, in 0..1 coordinates.
const columns = [
    { x: 0.2, y: 0.22, width: 0.16, height: 0.56 },
    { x: 0.42, y: 0.22, width: 0.16, height: 0.38 },
    { x: 0.64, y: 0.22, width: 0.16, height: 0.48 }
]

// Anti-aliasing: averages a grid of samples inside the pixel; `shade` returns null where nothing is painted.
function samplePixel(pixelX, pixelY, size, shade) {
    let sum = [0, 0, 0, 0]
    for (let subY = 0; subY < SUPERSAMPLES_PER_AXIS; subY++) {
        for (let subX = 0; subX < SUPERSAMPLES_PER_AXIS; subX++) {
            const sampleX = (pixelX + (subX + 0.5) / SUPERSAMPLES_PER_AXIS) / size
            const sampleY = (pixelY + (subY + 0.5) / SUPERSAMPLES_PER_AXIS) / size
            const color = shade(sampleX, sampleY)
            if (color) sum = sum.map((channelSum, channel) => channelSum + color[channel])
        }
    }
    return sum
}

// Colors are un-premultiplied by the accumulated alpha so partially covered edges keep the full color.
function writePixel(pixels, offset, sum) {
    const [redSum, greenSum, blueSum, alphaSum] = sum
    const alpha = alphaSum / (SUPERSAMPLES_PER_AXIS * SUPERSAMPLES_PER_AXIS)
    const coverage = alphaSum / 255
    pixels[offset] = alpha ? redSum / coverage : 0
    pixels[offset + 1] = alpha ? greenSum / coverage : 0
    pixels[offset + 2] = alpha ? blueSum / coverage : 0
    pixels[offset + 3] = alpha
}

function render(size, shade) {
    const pixels = Buffer.alloc(size * size * BYTES_PER_PIXEL)
    for (let pixelY = 0; pixelY < size; pixelY++) {
        for (let pixelX = 0; pixelX < size; pixelX++) {
            const sum = samplePixel(pixelX, pixelY, size, shade)
            writePixel(pixels, (pixelY * size + pixelX) * BYTES_PER_PIXEL, sum)
        }
    }
    return encodePng(size, pixels)
}

const isOnColumn = (sampleX, sampleY) =>
    columns.some((column) =>
        isInsideRoundedRect(sampleX, sampleY, column.x, column.y, column.width, column.height, column.width * 0.3)
    )

const WHITE = [255, 255, 255, 255]
const BLACK = [0, 0, 0, 255]

// App icon: rounded red background, darker towards the bottom, with white columns.
const appShade = (sampleX, sampleY) => {
    if (!isInsideRoundedRect(sampleX, sampleY, 0.06, 0.06, 0.88, 0.88, 0.2)) return null
    if (isOnColumn(sampleX, sampleY)) return WHITE
    const red = Math.round(206 - 30 * sampleY)
    const greenAndBlue = Math.round(52 - 12 * sampleY)
    return [red, greenAndBlue, greenAndBlue, 255]
}

// Tray icon: template image (black + alpha) so macOS can invert it in dark mode.
// The columns are enlarged around the center to fill the small tray size.
const enlargeAroundCenter = (coordinate) => (coordinate - 0.5) * 1.25 + 0.5

const trayShade = (sampleX, sampleY) => {
    const isPainted = isOnColumn(enlargeAroundCenter(sampleX), enlargeAroundCenter(sampleY) + 0.03)
    return isPainted ? BLACK : null
}

writeFileSync('build/icon.png', render(1024, appShade))
writeFileSync('resources/icon.png', render(256, appShade))
writeFileSync('resources/trayTemplate.png', render(16, trayShade))
writeFileSync('resources/trayTemplate@2x.png', render(32, trayShade))
console.log('icons generated')
