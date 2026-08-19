/** 人设展示名：接口里的 slug / 拼音 id 不直接上屏。 */

const KNOWN = {
  hh: '明日香',
  asuka: '明日香',
  mingrixiang: '明日香',
  'mingrixiang-companion': '明日香',
}

function keyOf(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
}

function mapKnown(raw) {
  const key = keyOf(raw)
  if (!key) return ''
  if (KNOWN[key]) return KNOWN[key]
  const stripped = key.replace(/-companion$/, '').replace(/-skill$/, '')
  if (KNOWN[stripped]) return KNOWN[stripped]
  return ''
}

function hasChinese(raw) {
  return /[\u4e00-\u9fff]/.test(String(raw || ''))
}

export function skillDisplayName(skill) {
  if (!skill) return '明日香'
  if (typeof skill === 'string') {
    return mapKnown(skill) || (hasChinese(skill) ? skill.trim() : '明日香')
  }

  const fields = [
    skill.display_name,
    skill.displayName,
    skill.cn_name,
    skill.zh_name,
    skill.title,
    skill.character,
    skill.character_name,
    skill.name,
    skill.id,
  ]

  for (const f of fields) {
    if (f && hasChinese(f)) return String(f).trim()
  }
  for (const f of fields) {
    const mapped = mapKnown(f)
    if (mapped) return mapped
  }

  const fallback = String(skill.name || skill.id || '').trim()
  return hasChinese(fallback) ? fallback : '明日香'
}
