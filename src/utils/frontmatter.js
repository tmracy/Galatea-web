// 极简 frontmatter 解析：支持 `key: value` 与 `key: |` 块标量（如 description）。
export function parseFrontmatter(md) {
  const result = { data: {}, body: md }
  const match = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/.exec(md)
  if (!match) return result
  const [, raw, body] = match
  result.body = body

  const lines = raw.split('\n')
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line)
    if (!kv) {
      i++
      continue
    }
    const key = kv[1]
    let val = kv[2]
    if (val === '|' || val === '>') {
      // 块标量：收集后续缩进行
      const collected = []
      i++
      while (i < lines.length && /^\s+/.test(lines[i])) {
        collected.push(lines[i].replace(/^\s+/, ''))
        i++
      }
      val = collected.join(val === '|' ? '\n' : ' ').trim()
    } else {
      val = val.replace(/^["']|["']$/g, '')
      i++
    }
    result.data[key] = val
  }
  return result
}
