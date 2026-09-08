export class SchemaError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'SchemaError'
  }
}

export class RedactionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RedactionError'
  }
}
