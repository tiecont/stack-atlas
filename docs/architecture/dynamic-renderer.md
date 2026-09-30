# Dynamic structured-content renderer

`features/content-renderer/` consumes the API-owned Content Document V1 shape
for learner public content and admin preview. A document contains
`schema_version`, title, description, and ordered blocks. Every block has the
`{ id, type, version, props }` envelope. Web maintains an independent mirror of
the persisted API contract and imports no contract source from the API repo.

The canonical JSON fixture is
`tests/fixtures/content-document.v1.json`. Renderer tests load this fixture
directly so the public and preview surfaces exercise the persisted V1 shape.
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

## Safety rules

- The registry is a source-controlled block-type-to-component allowlist.
- Content cannot select a React import, style object, CSS class, event handler,
  script, or executable expression.
- Links accept local paths, fragments, and HTTP(S). External links open in a
  new tab with `noopener noreferrer`; unsafe schemes render as text.
- Images accept local paths or HTTPS sources and send no referrer.
- There is no `eval`, `Function`, script execution, or
  `dangerouslySetInnerHTML` in this feature.

Existing article HTML remains on its separate allowlist renderer. Git content
is not converted into structured blocks by this renderer.
