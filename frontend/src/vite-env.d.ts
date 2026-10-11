declare module 'virtual:legal-contact' {
  import type { ContactImage } from '../legalContact'
  export const postalAddress: ContactImage | null
  export const contactEmail: ContactImage | null
}
