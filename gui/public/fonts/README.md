# Emoji font (not in git)

The maintainer's local build bundles Apple Color Emoji as a web font here so
role icons render identically everywhere. Apple's font is **copyrighted and
cannot be redistributed**, so this folder ships empty in the public repo.

You don't need it: when the files are absent the CSS font stack falls back to
your system's emoji font (Apple Color Emoji on macOS, Segoe UI Emoji on
Windows, Noto Color Emoji on Linux), which looks right on each platform.

If you want a bundled font for a custom build, drop any emoji `.ttf` you are
licensed to use in this folder — [Noto Color Emoji](https://fonts.google.com/noto/specimen/Noto+Color+Emoji)
(OFL) is the usual choice — and wire it up in `gui/app/fonts.css`.
