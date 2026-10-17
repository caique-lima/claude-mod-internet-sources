export type SourcePage = {
  url: string
  domain: string
  /** WebFetch: page content read into context. WebSearch: surfaced as a search hit. */
  via: 'fetch' | 'search'
  title?: string
  /** Estimated tokens added to the context (chars / 4). */
  tokens: number
  hits: number
  at: number
}
export type SourcesView = { domain?: string; note?: string }

declare module 'claude-code' {
  interface PluginState {
    'internet-sources': { pages: SourcePage[]; view: SourcesView }
  }
}
