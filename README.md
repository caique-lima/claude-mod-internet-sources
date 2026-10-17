# internet-sources

A Claude Code mod: a side panel listing every web page used in the session, grouped by domain, with estimated tokens per page and markdown export.

- `/internet-sources` opens the pane. Click a domain to list its pages.
- `Save .md` (or `/internet-sources-save`) writes `.cc-internet-sources/<session-id>.md`.
- Tracks WebFetch and WebSearch only. Tokens are estimates (chars / 4).

## Install

```
/plugin install internet-sources --marketplace caique-lima/claude-mod-internet-sources
```

For local development: `claude --plugin-dir .`
