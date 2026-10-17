import { test, expect } from 'claude-code/testing'

test('a fetched page is grouped under its domain with a token estimate', async ($, on) => {
  on('tool.call', { tool: 'WebFetch' }, () => ({
    result: { bytes: 10, code: 200, codeText: 'OK', result: 'x'.repeat(400), durationMs: 1, url: 'https://www.github.com/a/b' },
  }) as any)

  await $.tool.call({ tool: 'WebFetch', input: { url: 'https://www.github.com/a/b', prompt: 'p' } } as any)

  const ui = await $.ui.mount({ plugin: 'internet-sources', surface: 'terminal', component: 'Pane', props: { title: 'Internet sources' }, requestId: 'internet-sources' } as any)
  expect(await ui.find({ type: 'Text', text: /1 pages · 1 domains · ~100 tokens/ })).toBeDefined()
  await ui.press({ key: 'd:github.com' })
  expect(await ui.find({ type: 'Text', text: /~100 tok/ })).toBeDefined()
})
