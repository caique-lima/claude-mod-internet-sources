import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { SourcePage } from '../types'

const PANE = 'internet-sources'
const DIR = '.cc-internet-sources'
const pages = atom({ plugin: 'internet-sources', key: 'pages' } as const, [] as SourcePage[])
const view = atom({ plugin: 'internet-sources', key: 'view' } as const, {} as { domain?: string; note?: string })

const tokensOf = (text: string) => Math.ceil(text.length / 4)

const domainOf = (url: string) => {
  const m = /^[a-z][a-z0-9+.-]*:\/\/([^/?#:]+)/i.exec(url)
  return (m ? m[1] : url).toLowerCase().replace(/^www\./, '')
}

/** Merge a page in: a repeat of the same url and route adds its tokens and a hit. */
const addPage = (list: SourcePage[], p: Omit<SourcePage, 'hits' | 'at'>): SourcePage[] => {
  const i = list.findIndex(x => x.url === p.url && x.via === p.via)
  if (i < 0) return [...list, { ...p, hits: 1, at: Date.now() }]
  return list.map((x, j) =>
    j === i ? { ...x, tokens: x.tokens + p.tokens, hits: x.hits + 1, at: Date.now() } : x,
  )
}

const byDomain = (list: SourcePage[]) => {
  const map = new Map<string, SourcePage[]>()
  for (const p of list) map.set(p.domain, [...(map.get(p.domain) ?? []), p])
  return [...map.entries()]
    .map(([domain, items]) => ({
      domain,
      items,
      tokens: items.reduce((n, p) => n + p.tokens, 0),
    }))
    .sort((a, b) => b.items.length - a.items.length || b.tokens - a.tokens)
}

const toMarkdown = (id: string, list: SourcePage[]) => {
  const groups = byDomain(list)
  const total = list.reduce((n, p) => n + p.tokens, 0)
  const lines = [
    `# Internet sources — session ${id}`,
    '',
    `${list.length} pages across ${groups.length} domains · ~${total} tokens (estimated, chars/4)`,
    '',
  ]
  for (const g of groups) {
    lines.push(`## ${g.domain} (${g.items.length} pages, ~${g.tokens} tokens)`, '')
    for (const p of g.items) {
      const label = p.title ?? p.url
      lines.push(`- [${label}](${p.url}) — ${p.via === 'fetch' ? 'fetched' : 'search hit'}, ~${p.tokens} tokens${p.hits > 1 ? `, ×${p.hits}` : ''}`)
    }
    lines.push('')
  }
  return lines.join('\n')
}

async function save($: any) {
  const id = await $.session.id()
  const list = await read($, pages)
  const path = `${DIR}/${id}.md`
  await $.fs.write(path, toMarkdown(id, list))
  await update($, view, v => ({ ...v, note: `Saved ${list.length} pages to ${path}` }))
  return path
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'internet-sources', description: 'Open the internet sources pane' })
    await $.command.register({ name: 'internet-sources-save', description: `Save the sources list to ${DIR}/<session>.md` })
    return next(e)
  })

  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') {
      await update($, pages, () => [])
      await update($, view, () => ({}))
    }
    return next(e)
  })

  on('command.run', { command: 'internet-sources' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Internet sources' })
    return { text: 'Internet sources pane opened.' }
  })

  on('command.run', { command: 'internet-sources-save' }, async $ => {
    const path = await save($)
    return { text: `Saved to ${path}` }
  })

  on('tool.call', { tool: 'WebFetch' }, async ($, e, next) => {
    const ran: any = await next(e)
    if (ran.deny === undefined && ran.isError !== true && ran.result) {
      const url: string = ran.result.url ?? e.url
      const text: string = typeof ran.result.result === 'string' ? ran.result.result : ''
      await update($, pages, list =>
        addPage(list, { url, domain: domainOf(url), via: 'fetch', tokens: tokensOf(text) }),
      )
    }
    return ran
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'WebSearch' }, async ($, e, next) => {
    const ran: any = await next(e)
    if (ran.deny === undefined && ran.isError !== true && ran.result) {
      const hits: { title: string; url: string }[] = []
      for (const r of ran.result.results ?? []) {
        if (typeof r !== 'string') hits.push(...r.content)
      }
      await update($, pages, list =>
        hits.reduce(
          (acc, h) =>
            addPage(acc, {
              url: h.url,
              domain: domainOf(h.url),
              via: 'search',
              title: h.title,
              tokens: tokensOf(`${h.title} ${h.url}`),
            }),
          list,
        ),
      )
    }
    return ran
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const list = await read($, pages)
    const v = await read($, view)
    const groups = byDomain(list)
    const total = list.reduce((n, p) => n + p.tokens, 0)
    const room = Math.max(1, (e.viewport?.rows ?? 24) - 8)
    const group = v.domain === undefined ? undefined : groups.find(g => g.domain === v.domain)

    const footer = (
      <Box flexDirection="column" marginTop={1}>
        {v.note !== undefined && <Text color="success">{v.note}</Text>}
        <Box>
          <Button variant="primary" hotkey="s" label="Save .md" onPress={() => save($)} />
          {group && (
            <Button hotkey="b" label="Back" onPress={() => update($, view, () => ({}))} />
          )}
        </Box>
      </Box>
    )

    if (group) {
      return (
        <Box flexDirection="column">
          <Text bold>{group.domain}</Text>
          <Text dimColor>{group.items.length} pages · ~{group.tokens} tokens</Text>
          {group.items.slice(0, room).map(p => (
            <Box flexDirection="column" marginTop={1}>
              <Text wrap="truncate-end">{p.title ?? p.url}</Text>
              <Text dimColor wrap="truncate-end">
                {p.via === 'fetch' ? 'fetched' : 'search hit'} · ~{p.tokens} tok{p.hits > 1 ? ` · ×${p.hits}` : ''}
              </Text>
              <Text dimColor wrap="truncate-end">{p.url}</Text>
            </Box>
          ))}
          {footer}
        </Box>
      )
    }

    return (
      <Box flexDirection="column">
        <Text bold>Internet sources</Text>
        <Text dimColor>{list.length} pages · {groups.length} domains · ~{total} tokens (est.)</Text>
        {groups.length === 0 && <Text dimColor>No web pages accessed yet.</Text>}
        {groups.slice(0, room).map(g => (
          <Button
            plain
            key={`d:${g.domain}`}
            label={`${g.domain} · ${g.items.length} · ~${g.tokens} tok`}
            onPress={() => update($, view, () => ({ domain: g.domain }))}
          />
        ))}
        {footer}
      </Box>
    )
  })
}
