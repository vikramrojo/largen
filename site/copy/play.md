# Playground page prose. Structure lives in skill/scripts/pages.mjs.

## page-desc
Edit a spec and watch it validate and render. The validator and the renderer
here are the same modules the MCP server imports, not a reimplementation of
them, so this page cannot disagree with `validate_spec`.

## share-note
The share link carries the spec in the URL fragment, so it never reaches the
server and needs nothing stored to work.
