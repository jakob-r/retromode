import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import opentype from 'opentype.js'
import type { Plugin } from 'vite'

const VIRTUAL_ID = 'virtual:legal-contact'
const RESOLVED_ID = `\0${VIRTUAL_ID}`
const FONT_FILE = './node_modules/@fontsource/inter/files/inter-latin-400-normal.woff'
const FONT_SIZE = 16
const LINE_HEIGHT = 1.5
// --color-ink
const FILL = '#2b2140'

export interface ContactImage {
  src: string
  width: number
  height: number
}

/**
 * Renders lines of text as an SVG made of glyph outlines only, so the result contains no
 * machine-readable text for scrapers.
 */
function renderOutlinedText(font: opentype.Font, lines: string[]): ContactImage {
  const lineHeight = FONT_SIZE * LINE_HEIGHT
  const ascent = (font.ascender / font.unitsPerEm) * FONT_SIZE
  const paths = lines.map((line, i) =>
    font.getPath(line, 0, ascent + i * lineHeight, FONT_SIZE).toPathData(2),
  )
  const width = Math.ceil(Math.max(...lines.map((line) => font.getAdvanceWidth(line, FONT_SIZE))))
  const height = Math.ceil(lineHeight * (lines.length - 1) + FONT_SIZE * 1.25)
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<path fill="${FILL}" d="${paths.join('')}"/></svg>`
  return { src: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`, width, height }
}

/**
 * Provides `virtual:legal-contact`: the operator's postal address and email for the legal pages,
 * rendered from the CONTACT_EMAIL and ADDRESS env vars at build time so they never live in git.
 * ADDRESS is comma separated; each part becomes one line.
 */
export function legalContact(env: Record<string, string | undefined>): Plugin {
  return {
    name: 'legal-contact',
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : undefined
    },
    load(id) {
      if (id !== RESOLVED_ID) return undefined
      const email = env.CONTACT_EMAIL?.trim()
      const addressLines = (env.ADDRESS ?? '')
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
      if (!email || !addressLines.length) {
        this.warn(
          'CONTACT_EMAIL or ADDRESS is not set; the legal pages will show no contact details.',
        )
      }
      const file = readFileSync(fileURLToPath(new URL(FONT_FILE, import.meta.url)))
      const font = opentype.parse(
        file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength),
      )
      const postalAddress = addressLines.length ? renderOutlinedText(font, addressLines) : null
      const contactEmail = email ? renderOutlinedText(font, [email]) : null
      return (
        `export const postalAddress = ${JSON.stringify(postalAddress)}\n` +
        `export const contactEmail = ${JSON.stringify(contactEmail)}\n`
      )
    },
  }
}
