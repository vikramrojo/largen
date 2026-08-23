# Design

## Context

Eleven recommendations from one migration, ordered by time cost. Two of them are
decisions rather than tasks, one reverses a documented refusal, and one is
deferred because the obvious shape of it is a security hole. Those four are what
this document is for; the rest are straightforward and live in `tasks.md`.

Three claims from the report were checked in a browser before being written down.
Two held. One did not, and the correction matters more than the recommendation.

## Decisions

### 1. The link recipe in the report does not work

The report proposes `--fg: inherit` so a link keeps the colour around it, with
the reasoning that the CSS-wide keyword leaves the slot guaranteed-invalid. The
reasoning is exactly right. The outcome is not:

```
--fg: inherit       → rgb(0,0,238)   the user-agent link colour
--fg: currentColor  → rgb(3,4,5)     the surrounding colour
color: inherit      → rgb(3,4,5)     the surrounding colour
```

`inherit` takes the parent's computed `--fg`, which is guaranteed-invalid because
the slot does not inherit and the parent never set it. So `var(--fg, revert-layer)`
fires — and reverting hands the property to the user-agent stylesheet, which
colours links blue. Guaranteed-invalid gets you the UA value, not the ambient one.

`--fg: currentColor` is the documented recipe, staying inside the slot system.
`color: inherit` is noted as equivalent for anyone who prefers the plain property.

That a careful reader derived the mechanism correctly and still predicted the
wrong result is the argument for documenting it. Someone who reasons less
carefully will not even get as far as being wrong in an interesting way.

### 2. The fixed-size control is a reframe, not an escape hatch

Rule 4 says never write a size variant: multiply by `var(--scale)` and express the
rest in `em`, so padding follows type. The report's counter-example is a control
that must shrink its box while holding type at 14px, which the rule appears to
forbid without offering an alternative.

It does not forbid it. `em` is what couples padding to type; `rem` is what
decouples them. A control that wants a fixed box at a fixed type size sets its
padding in `rem` and leaves `--font-size` alone. The rule is about not writing
*five variants of the same component*, not about padding units.

So rule 4 gains a caveat rather than an exception. An exception would invite the
size-variant matrix back in through a side door; a caveat says what the rule was
always about.

### 3. A utility mapping table, bounded

The migration guide deliberately provides no mapping table, and the argument for
that is sound: porting a variant matrix is the mistake the guide exists to
prevent, and a table invites it.

The argument does not extend to utilities. `px-4` is `--pad: 0 1rem`. There is no
judgement in it, no naming decision, nothing to get philosophically wrong — and
the report converted roughly 820 tokens by hand, most of them mechanical. Refusing
to write that table does not protect anyone from anything; it just charges a tax.

The table is therefore bounded to spacing, flex and type, and says in its own
header why components are absent. The line is: if an entry needs a judgement about
naming or structure, it does not belong in a table.

### 4. `computed_styles` — deferred, with the shape decided

The report calls this the single most useful possible addition and used a
hand-built version about twenty times, where it turned guesswork into diagnosis
every time a screenshot diff was ambiguous. That is a strong signal and the
deferral is not a rejection.

As proposed — `computed_styles({ css, html, selectors, theme })` — it requires a
browser engine on a **public endpoint with no authentication**, taking arbitrary
CSS and arbitrary HTML. HTML carries `<script>`. That is remote code execution on
the host unless it is sandboxed, and sandboxing a browser well is a larger
undertaking than everything else in this change combined. It is weight comparable
to the server-side model that `generate_ui` was refused for.

Three shapes were considered.

- **Arbitrary HTML, sandboxed.** Highest fidelity, and the only one that can
  inspect a migrator's *existing* markup, which is what they actually have.
  Rejected for now: the sandbox is the whole project, not a detail of it.
- **No tool; keep recommending a local harness.** The reporter built one in an
  afternoon and it worked. Cheapest, and it leaves the highest-value item on the
  table indefinitely.
- **A validated spec instead of HTML** — chosen shape, deferred execution.
  `validate_spec` already rejects every field in which script could be expressed,
  and `render.mjs` already turns a spec into markup, so
  `computed_styles({ css, spec, selectors, theme })` reuses both and removes the
  class of attack rather than defending against it.

The honest cost of the chosen shape: it cannot answer questions about markup the
caller already has, which is the majority of what a migration needs. It would have
helped with new components and not with the `.prose kbd` problem. That is a real
limitation and the reason this is deferred rather than built now — it is worth
knowing whether the cheap tools below close enough of the gap first.

### 5. Batching keeps the single-string form

`check_component_css` gains an array. The existing signature keeps working rather
than being replaced, because the server has a caller mid-migration and breaking it
to save a parameter would be a poor trade.

### 6. The layer check is static, and that is the point

Both of the report's most expensive bugs were cross-file layer-order problems. The
contract now documents them, which helps someone who already suspects a layer
problem — and the symptom of one was `--weight: 900` computing as `300`, which
does not look like a layer problem at all.

Resolving layer order needs only the set of stylesheets and their `@layer`
statements: which layer is mentioned first, and which parents already hold a
position. No browser required. This is the one class of bug in the report that a
linter genuinely could have caught, and it is worth catching precisely because the
symptom points somewhere else.

## Risks / Trade-offs

**The rename is breaking.** → `--leading` is now `--line-height-base`. One vendored
consumer exists and does not set it; a later one would fail loudly, since an unset
token yields no leading rather than a wrong one.

**Fourteen slots is a wider paint rule.** → Measured: unmeasurable at 1,609
elements, because unset slots fall back rather than compute. Unlike the tone
derivations, these do not evaluate.

**A bounded table will be asked to grow.** → The boundary is stated in the table
rather than in a commit message, so the next person to consider adding a component
row reads the reason first.

## Open Questions

- Whether the cheap MCP additions close enough of the gap that `computed_styles`
  stops being the top request. That is the thing to find out before building it.
- Whether the property-to-slot lookup should be a tool at all, or whether
  `get_contract` returning the slot-to-property mapping makes it unnecessary.
