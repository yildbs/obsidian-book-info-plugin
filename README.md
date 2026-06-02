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

## Template placeholders

The default template and user-selected template notes can use these placeholders:

```text
<@YYYYMMDD@>
<@YYYY-MM-DD@>
<@TIMESTAMP@>
<@BOOKTITLE@>
<@BOOKSUBTITLE@>
<@BOOKAUTHOR@>
<@BOOKAUTHORS@>
<@BOOKPUBLISHER@>
<@BOOKPUBLISHEDDATE@>
<@BOOKCATEGORY@>
<@BOOKISBN@>
<@BOOKPAGE@>
<@BOOKDESCRIPTION@>
<@BOOKURL@>
<@BOOKTHUMBNAILURL@>
<@BOOKTHUMBNAIL@>
```

`<@BOOKTHUMBNAILURL@>` is the source image URL. `<@BOOKTHUMBNAIL@>` renders an Obsidian embed such as:

```markdown
![[attachments/20260602_1780374991571.jpg]]
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
