# Dynamic structured-content renderer

`features/content-renderer/` provides the shared React renderer foundation for
learner public content and admin preview. A typed `BlockDocument` is passed to
`BlockRenderer`, which uses an explicit allowlist registry to select React
components. This is a Web UI fixture format only; it is not an API or persisted
content contract. It is not connected to the current learner catalog.

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

Rich text nodes include `paragraph`, `text`, `bold`, `italic`, `inline_code`,
`link`, `bullet_list`, and `ordered_list`. Text is rendered as React children,
which keeps markup escaped. The renderer does not accept raw HTML.

## Unknown and malformed blocks

The runtime validates each block shape before dispatch. `mode="preview"`
shows the unsupported block type for development/admin diagnostics. Public
mode shows a safe generic unsupported-content message. Unsupported data is
never silently dropped or interpreted as a component path.

## Safety rules

- The registry is a source-controlled block-type-to-component allowlist.
- Content cannot select a React import, style object, CSS class, event handler,
  script, or executable expression.
- Links accept local paths, fragments, and HTTP(S). External links open in a
  new tab with `noopener noreferrer`; unsafe schemes render as text.
- Images accept local paths or HTTPS sources and send no referrer.
- There is no `eval`, `Function`, script execution, or
  `dangerouslySetInnerHTML` in this feature.

`tests/fixtures/structured-block-document.ts` exercises the renderer without
converting the Git catalog. Existing article HTML remains on its separate
allowlist renderer. Before API content is rendered here, API-owned document
fields and validation rules must be aligned in the authoring phase; this
fixture must not be mistaken for an early API contract.
