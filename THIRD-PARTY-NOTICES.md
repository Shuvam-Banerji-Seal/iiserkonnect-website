# Third-party notices

The web app is plain static files. These pieces were written by others and are included in
this repository:

| What | Where | Licence |
|---|---|---|
| Material Design Icons (filled set) — the icon path data, a subset of `@material-design-icons/svg` 0.14.15 | `scripts/ui/icons.js` | Apache License 2.0 — full text in `assets/licenses/APACHE-2.0-material-design-icons.txt`. Copyright Google LLC. |
| Roboto (variable, Latin and Latin Extended subsets) via `@fontsource-variable/roboto` 5.2.8 | `assets/fonts/*.woff2` | SIL Open Font License 1.1 — full text in `assets/fonts/OFL.txt`. Copyright 2011 The Roboto Project Authors. |
| QR Code Generator for JavaScript, `qrcode-generator` 1.4.4 | `scripts/vendor/qrcode-generator.js` | MIT — Copyright (c) 2009 Kazuhiko Arase. The original header is kept in the file; only the module wrapper at the end was changed. |

MIT licence text for `qrcode-generator`:

> Permission is hereby granted, free of charge, to any person obtaining a copy of this software
> and associated documentation files (the "Software"), to deal in the Software without
> restriction, including without limitation the rights to use, copy, modify, merge, publish,
> distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the
> Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or
> substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING
> BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
> NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
> DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

The QR Code word mark is a registered trademark of DENSO WAVE INCORPORATED.

The smoke test uses Playwright (Apache-2.0) as a development dependency; it is installed by
`npm install` and is not part of the site.
