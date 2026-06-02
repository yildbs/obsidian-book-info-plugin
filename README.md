# Book Info

Book Info is an Obsidian plugin for searching book metadata and creating book notes from templates.

## Features

- Adds an **Import book metadata** ribbon button and command.
- Searches book metadata from a selectable provider.
- Supports YES24 as the first provider.
- Shows multiple search results so you can choose the exact edition.
- Creates a new note in the vault root with a unique `YYYYMMDD_timestamp.md` filename.
- Optionally uses an existing Markdown note as a template.
- Uses `default-book-template.md` from the plugin folder when no template note is selected.
- Downloads the book cover to Obsidian's configured attachment folder path.

## Default template

When no template note is selected in the search modal, the plugin uses:

```text
default-book-template.md
```

Edit this file to change the bundled default book note format. The file is copied into the production build output with `main.js`, `manifest.json`, and `styles.css`.

Production build output:

```text
build_output/obsidian-book-info-plugin/main.js
build_output/obsidian-book-info-plugin/manifest.json
build_output/obsidian-book-info-plugin/styles.css
build_output/obsidian-book-info-plugin/default-book-template.md
```

## Custom templates

You can create and edit your own template note anywhere in your vault.

1. Create a Markdown note for your book template.
2. Add any placeholders listed below, such as `<@BOOKTITLE@>` or `<@BOOKTHUMBNAIL@>`.
3. Open **Import book metadata**.
4. Select your note from **Template note**.
5. Search for a book and select a result.

The plugin copies the selected template note, replaces the placeholders with book metadata, and creates a new book note in the vault root. The original template note is not modified.

Once a template note is selected, the plugin remembers that path and automatically selects it the next time the search modal opens. Clear the template selection to return to `default-book-template.md`.

## Template placeholders

`default-book-template.md` and user-selected template notes can use these placeholders:

| Placeholder | Description | Example |
| --- | --- | --- |
| `<@YYYYMMDD@>` | Note creation date in compact format. | `20260602` |
| `<@YYYY-MM-DD@>` | Note creation date in dashed format. | `2026-06-02` |
| `<@TIMESTAMP@>` | Note creation timestamp from `Date.now()`. | `1780376512705` |
| `<@BOOKTITLE@>` | Book title. | `워런 버핏 라이브` |
| `<@BOOKSUBTITLE@>` | Book subtitle, if available. | `버크셔 해서웨이 주주총회 33년간의 Q&A 지상 중계` |
| `<@BOOKAUTHOR@>` | Authors joined with commas. | `대니얼 피컷, 코리 렌, 이건, 신진오` |
| `<@BOOKAUTHORS@>` | Same as `<@BOOKAUTHOR@>` for now. | `대니얼 피컷, 코리 렌, 이건, 신진오` |
| `<@BOOKPUBLISHER@>` | Publisher. | `에프엔미디어` |
| `<@BOOKPUBLISHEDDATE@>` | Published date from the provider. | `2019-02-25` |
| `<@BOOKCATEGORY@>` | Primary book category or genre from the provider. | `경제 경영` |
| `<@BOOKISBN@>` | ISBN13 when available. | `9791188754113` |
| `<@BOOKPAGE@>` | Total page count when available. | `300` |
| `<@BOOKDESCRIPTION@>` | Book description or introduction, normalized to one line. | `버크셔 해서웨이 주주총회...` |
| `<@BOOKURL@>` | Provider detail page URL. | `https://www.yes24.com/Product/Goods/69758284` |
| `<@BOOKTHUMBNAILURL@>` | Source cover image URL. | `https://image.yes24.com/goods/69758284/XL` |
| `<@BOOKTHUMBNAIL@>` | Obsidian image embed for the downloaded cover. | `![[attachments/20260602_1780376512705.jpg&#124;200]]` |

`<@BOOKTHUMBNAILURL@>` is the source image URL. `<@BOOKTHUMBNAIL@>` renders an Obsidian embed with a default width of 200px:

```markdown
![[attachments/20260602_1780376512705.jpg|200]]
```

If the cover download fails, the plugin falls back to a remote Markdown image.

## Development

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```
