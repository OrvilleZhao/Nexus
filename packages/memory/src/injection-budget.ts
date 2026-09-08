export interface InjectionBudgetOptions {
  maxTokens?: number
}

export interface TokenCosted {
  tokens: number
  score: number
}

export class InjectionBudget {
  private readonly maxTokens: number
  private used: number

  constructor(opts: InjectionBudgetOptions = {}) {
    this.maxTokens = opts.maxTokens ?? 2000
    this.used = 0
  }

  get remaining(): number { return this.maxTokens - this.used }
  get fractionUsed(): number { return this.used / this.maxTokens }

  canFit(tokens: number): boolean { return tokens <= this.remaining }

  consume(tokens: number): boolean {
    if (tokens > this.remaining) return false
    this.used += tokens
    return true
  }

  selectIncluded(items: TokenCosted[]): number[] {
    const included: number[] = []
    for (let i = 0; i < items.length; i++) {
      if (this.consume(items[i]!.tokens)) included.push(i)
    }
    return included
  }

  reset(): void { this.used = 0 }
}
