export type DiffPart = { type: 'same' | 'add' | 'del'; text: string }

/** Word-level diff via a simple LCS. Good enough for short notes. */
export function diffWords(a: string, b: string): DiffPart[] {
  const tok = (s: string): string[] => s.match(/\s+|\S+/g) ?? []
  const A = tok(a)
  const B = tok(b)
  const n = A.length
  const m = B.length

  // LCS length table
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  const parts: DiffPart[] = []
  const push = (type: DiffPart['type'], text: string): void => {
    const last = parts[parts.length - 1]
    if (last && last.type === type) last.text += text
    else parts.push({ type, text })
  }

  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (A[i] === B[j]) {
      push('same', A[i])
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      push('del', A[i])
      i++
    } else {
      push('add', B[j])
      j++
    }
  }
  while (i < n) push('del', A[i++])
  while (j < m) push('add', B[j++])
  return parts
}

export function hasRealChange(parts: DiffPart[]): boolean {
  return parts.some((p) => p.type !== 'same' && p.text.trim().length > 0)
}
