---
title: Playground · largen
description: Render a largen spec in the browser. Shareable through the URL fragment, with nothing stored server-side.
nav: play
route: site/public/play.html
---

# Playground

Edit a spec and watch it validate and render. The validator and the renderer
here are the same modules the MCP server imports, not a reimplementation of
them, so this page cannot disagree with `validate_spec`.

Specs validate against largen's **reference components**, the same set the
MCP tools fall back to when you pass no manifest of your own. A spec may only
name components from that list; anything else is rejected before it renders.

::playground

## Generate a spec with Claude

Copy the prompt below into Claude, replace the `[instruction]:` line with what
you want built, and paste the JSON it returns into the editor above.

::genai-prompt
