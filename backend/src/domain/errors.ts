import type { ErrorCode } from '@retromode/shared'

export class DomainError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'DomainError'
  }
}

export const notFound = (what: string) => new DomainError('NOT_FOUND', `${what} not found`)
export const forbidden = (message: string) => new DomainError('FORBIDDEN', message)
export const invalid = (message: string) => new DomainError('INVALID', message)
