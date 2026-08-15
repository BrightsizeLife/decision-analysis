// A small, safe arithmetic-expression evaluator for custom utility formulas.
// Supports numbers, variables, + - * / ^, parentheses, and a fixed set of
// functions. No eval / new Function, so it runs under any CSP.

type Node =
  | { t: 'num'; v: number }
  | { t: 'var'; name: string }
  | { t: 'neg'; a: Node }
  | { t: 'bin'; op: '+' | '-' | '*' | '/' | '^'; a: Node; b: Node }
  | { t: 'call'; name: string; args: Node[] }

const FUNCTIONS: Record<string, { arity: [number, number]; fn: (args: number[]) => number }> = {
  min: { arity: [1, 99], fn: (a) => Math.min(...a) },
  max: { arity: [1, 99], fn: (a) => Math.max(...a) },
  log: { arity: [1, 1], fn: (a) => Math.log(a[0]) },
  log10: { arity: [1, 1], fn: (a) => Math.log10(a[0]) },
  exp: { arity: [1, 1], fn: (a) => Math.exp(a[0]) },
  sqrt: { arity: [1, 1], fn: (a) => Math.sqrt(a[0]) },
  abs: { arity: [1, 1], fn: (a) => Math.abs(a[0]) },
  pow: { arity: [2, 2], fn: (a) => Math.pow(a[0], a[1]) },
  floor: { arity: [1, 1], fn: (a) => Math.floor(a[0]) },
  ceil: { arity: [1, 1], fn: (a) => Math.ceil(a[0]) },
  round: { arity: [1, 1], fn: (a) => Math.round(a[0]) },
  clamp: { arity: [3, 3], fn: (a) => Math.min(Math.max(a[0], a[1]), a[2]) },
}

const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E }

interface Token {
  t: 'num' | 'id' | 'op' | 'lparen' | 'rparen' | 'comma'
  v: string
  pos: number
}

function tokenize(src: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (/\s/.test(c)) {
      i++
      continue
    }
    if (/[0-9.]/.test(c)) {
      const m = /^[0-9]*\.?[0-9]+(?:[eE][+-]?[0-9]+)?/.exec(src.slice(i))
      if (!m) throw new ExprError(`Bad number at position ${i + 1}`)
      tokens.push({ t: 'num', v: m[0], pos: i })
      i += m[0].length
      continue
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i))!
      tokens.push({ t: 'id', v: m[0], pos: i })
      i += m[0].length
      continue
    }
    if ('+-*/^'.includes(c)) {
      tokens.push({ t: 'op', v: c, pos: i })
      i++
      continue
    }
    if (c === '(') {
      tokens.push({ t: 'lparen', v: c, pos: i })
      i++
      continue
    }
    if (c === ')') {
      tokens.push({ t: 'rparen', v: c, pos: i })
      i++
      continue
    }
    if (c === ',') {
      tokens.push({ t: 'comma', v: c, pos: i })
      i++
      continue
    }
    throw new ExprError(`Unexpected character “${c}” at position ${i + 1}`)
  }
  return tokens
}

export class ExprError extends Error {}

class Parser {
  private pos = 0
  constructor(
    private tokens: Token[],
    private allowed: Set<string>,
  ) {}

  parse(): Node {
    const node = this.parseExpr(0)
    if (this.pos < this.tokens.length) {
      throw new ExprError(`Unexpected “${this.tokens[this.pos].v}” after expression`)
    }
    return node
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos]
  }

  private parseExpr(minPrec: number): Node {
    let left = this.parseUnary()
    for (;;) {
      const tok = this.peek()
      if (!tok || tok.t !== 'op') break
      const prec = tok.v === '+' || tok.v === '-' ? 1 : tok.v === '*' || tok.v === '/' ? 2 : 4
      if (prec < minPrec) break
      this.pos++
      // ^ is right-associative.
      const right = this.parseExpr(tok.v === '^' ? prec : prec + 1)
      left = { t: 'bin', op: tok.v as '+' | '-' | '*' | '/' | '^', a: left, b: right }
    }
    return left
  }

  private parseUnary(): Node {
    const tok = this.peek()
    if (tok && tok.t === 'op' && (tok.v === '-' || tok.v === '+')) {
      this.pos++
      const a = this.parseUnary()
      return tok.v === '-' ? { t: 'neg', a } : a
    }
    return this.parsePrimary()
  }

  private parsePrimary(): Node {
    const tok = this.peek()
    if (!tok) throw new ExprError('Expression ends unexpectedly')
    if (tok.t === 'num') {
      this.pos++
      return { t: 'num', v: Number(tok.v) }
    }
    if (tok.t === 'lparen') {
      this.pos++
      const inner = this.parseExpr(0)
      this.expect('rparen', ')')
      return inner
    }
    if (tok.t === 'id') {
      this.pos++
      const next = this.peek()
      if (next && next.t === 'lparen') {
        const fn = FUNCTIONS[tok.v]
        if (!fn) throw new ExprError(`Unknown function “${tok.v}”`)
        this.pos++
        const args: Node[] = []
        if (this.peek()?.t !== 'rparen') {
          args.push(this.parseExpr(0))
          while (this.peek()?.t === 'comma') {
            this.pos++
            args.push(this.parseExpr(0))
          }
        }
        this.expect('rparen', ')')
        if (args.length < fn.arity[0] || args.length > fn.arity[1]) {
          throw new ExprError(`${tok.v}() takes ${fn.arity[0] === fn.arity[1] ? fn.arity[0] : `${fn.arity[0]}–${fn.arity[1]}`} argument(s)`)
        }
        return { t: 'call', name: tok.v, args }
      }
      if (tok.v in CONSTANTS) return { t: 'num', v: CONSTANTS[tok.v] }
      if (!this.allowed.has(tok.v)) {
        const list = [...this.allowed].join(', ') || '(none)'
        throw new ExprError(`Unknown variable “${tok.v}”. Available: ${list}`)
      }
      return { t: 'var', name: tok.v }
    }
    throw new ExprError(`Unexpected “${tok.v}”`)
  }

  private expect(t: Token['t'], label: string): void {
    const tok = this.peek()
    if (!tok || tok.t !== t) throw new ExprError(`Expected “${label}”`)
    this.pos++
  }
}

export interface CompiledExpr {
  eval(vars: Record<string, number>): number
  varsUsed: string[]
}

export type CompileResult = { ok: true; expr: CompiledExpr } | { ok: false; error: string }

export function compileExpr(src: string, allowed: Set<string>): CompileResult {
  try {
    if (!src.trim()) return { ok: false, error: 'Formula is empty' }
    const ast = new Parser(tokenize(src), allowed).parse()
    const used = new Set<string>()
    collectVars(ast, used)
    return {
      ok: true,
      expr: {
        varsUsed: [...used],
        eval: (vars) => evalNode(ast, vars),
      },
    }
  } catch (e) {
    return { ok: false, error: e instanceof ExprError ? e.message : String(e) }
  }
}

function collectVars(n: Node, out: Set<string>): void {
  switch (n.t) {
    case 'var':
      out.add(n.name)
      break
    case 'neg':
      collectVars(n.a, out)
      break
    case 'bin':
      collectVars(n.a, out)
      collectVars(n.b, out)
      break
    case 'call':
      n.args.forEach((a) => collectVars(a, out))
      break
    case 'num':
      break
  }
}

function evalNode(n: Node, vars: Record<string, number>): number {
  switch (n.t) {
    case 'num':
      return n.v
    case 'var':
      return vars[n.name] ?? NaN
    case 'neg':
      return -evalNode(n.a, vars)
    case 'bin': {
      const a = evalNode(n.a, vars)
      const b = evalNode(n.b, vars)
      switch (n.op) {
        case '+':
          return a + b
        case '-':
          return a - b
        case '*':
          return a * b
        case '/':
          return a / b
        case '^':
          return Math.pow(a, b)
      }
      break
    }
    case 'call':
      return FUNCTIONS[n.name].fn(n.args.map((a) => evalNode(a, vars)))
  }
  return NaN
}
