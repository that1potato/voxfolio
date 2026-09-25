# MSDF font atlases

Pre-built multi-channel signed distance field (MSDF) font atlases for the in-headset reading panel (`components/map/XRArticlePanel.tsx`). The panel draws text with `@react-three/uikit`, which can't use web fonts, so it loads these instead. This keeps text sharp at any distance in a WebXR session. The flat (non-XR) site doesn't use them; it loads its fonts through `next/font` in `app/layout.tsx`.

Each font is a `.json` glyph table plus a `.png` atlas:

| Files | Font | Used for |
| --- | --- | --- |
| `fraunces-700.*` | Fraunces Bold (700) | Titles and headings |
| `fira-sans-400.*` | Fira Sans Regular (400) | Body text |
| `fira-sans-600.*` | Fira Sans SemiBold (600) | Bold text, links, table headers, list markers, UI chrome |
| `fira-sans-400-italic.*` | Fira Sans Italic (400) | Emphasis |
| `fira-code-400.*` | Fira Code Regular (400) | Inline code |

## Charset

Latin only: 117 glyphs rendered at 48px. That's printable ASCII plus a few typographic and accented characters (`– — ‘ ’ “ ” … • · × ‹ › ← → é à è ö ü ç ° ▶`). Characters outside this set, such as CJK, Cyrillic, Greek or most accented letters, have no glyph and won't render in XR.

## Regenerating

Run the generator from the repo root:

```bash
bash scripts/generate-msdf-fonts.sh
```

It downloads the Latin TTFs, installs `msdf-bmfont-xml` in a temporary directory (so it never becomes a project dependency) and overwrites the atlases here. Edit the charset in the script to add glyphs.

`XRArticlePanel.tsx` loads these files by path (`FONT_FAMILIES`, `/fonts/msdf/*.json`), so keep the file names as they are. If you change the reading fonts in `article.config.ts`, the XR panel won't follow automatically. You'd need to regenerate the atlases for the new fonts and update `FONT_FAMILIES` and the `fontFamily` names used in `XRArticlePanel.tsx`.

## License

Fira Sans, Fira Code and Fraunces are licensed under the SIL Open Font License, Version 1.1. These atlases are derived from those fonts and are distributed under the same license. See [`OFL.txt`](./OFL.txt) for the copyright notices and the full license text.
