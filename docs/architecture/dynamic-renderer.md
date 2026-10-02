# Dynamic structured-content renderer

`features/content-renderer/` consumes the API-owned Content Document V1 shape
for learner public content and admin preview. A document contains
`schema_version`, title, description, and ordered blocks. Every block has the
`{ id, type, version, props }` envelope. Web maintains an independent mirror of
the persisted API contract and imports no contract source from the API repo.

The canonical JSON fixture is
`tests/fixtures/content/content-document-v1.json`. Renderer tests load this fixture
directly so the public and preview surfaces exercise the persisted V1 shape.
API owns the persisted contract. Web mirrors it independently, maintains its
own copied fixture, and imports no contract source from a sibling repository.
The renderer foundation is not connected to the current learner Git catalog.

## Supported block components

| Block             | Rendered content                                                    |
| ----------------- | ------------------------------------------------------------------- |
| `rich_text`       | Paragraphs, bullet lists, ordered lists, and inline text formatting |
| `heading`         | Level 2–4 headings                                                  |
| `code`            | Escaped code with a language label                                  |
| `callout`         | Info or warning note                                                |
| `image`           | Local or HTTPS image with alt text and optional caption             |
| `table`           | Header and row cells with optional caption                          |
| `divider`         | Semantic horizontal rule                                            |
| `related_content` | Links and optional descriptions                                     |

Paragraphs, lists, and inline formatting belong to
`rich_text.props.nodes`. Rich text nodes include `paragraph`, `text`, `bold`,
`italic`, `inline_code`, `link`, `bullet_list`, and `ordered_list`. Text is
rendered as React children, which keeps markup escaped. The renderer does not
accept raw HTML.

## Unknown and malformed blocks

The runtime validates the document envelope and every block before dispatch.
`mode="preview"` shows the unsupported block type for development/admin
diagnostics. Public mode shows a safe generic unsupported-content message.
Unsupported data is never silently dropped or interpreted as a component path.
`parseContentDocumentV1` validates the untrusted document envelope before the
registry validates each block's version and props. The fixture test asserts
that the supported type list, renderer registry keys, and fixture block types
stay in parity.

## Safety rules

- The registry is a source-controlled block-type-to-component allowlist.
- Content cannot select a React import, style object, CSS class, event handler,
  script, or executable expression.
- Links accept local paths, fragments, and HTTP(S). External links open in a
  new tab with `noopener noreferrer`; unsafe schemes and URLs with credentials
  are rejected as unsupported content.
- Images accept local paths or HTTPS sources without credentials and send no
  referrer.
- Heading anchors come from optional `props.anchor`; block `id` is only block
  identity and is never reused as a heading anchor.
- The Web mirror enforces the V1 limits: 1 MiB compact JSON, 500 blocks, 128
  character block IDs, 16 inline nesting levels, 100,000 UTF-8 code bytes, 20
  table columns, 100 table rows, 2,000 character table cells, 20 related items,
  and 2,048 character URLs.
- There is no `eval`, `Function`, script execution, or
  `dangerouslySetInnerHTML` in this feature.

Existing article HTML remains on its separate allowlist renderer. Git content
is not converted into structured blocks by this renderer.
