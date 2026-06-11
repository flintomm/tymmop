# Gunmetal "tp" favicon

Bold lettermark — white **tp** on gunmetal (`#2A2F36`), Arial Bold.

## Files
| File | Size | Use |
| --- | --- | --- |
| `favicon.ico` | 16/32/48 multi-res | Legacy browsers, default `/favicon.ico` |
| `favicon.svg` | vector | Modern browsers (crispest) |
| `favicon-32.png` | 32×32 | Browser tab |
| `favicon-16.png` | 16×16 | Small tab |
| `apple-touch-icon-180.png` | 180×180 | iOS home-screen |
| `favicon-512.png` | 512×512 | Master / source for any other size |

## How to assign (in `index.html` `<head>`)
Replace the current icon `<link>` tags with:

```html
<link rel="icon" href="assets/favicon-gunmetal/favicon.ico" sizes="any" />
<link rel="icon" href="assets/favicon-gunmetal/favicon.svg" type="image/svg+xml" />
<link rel="icon" type="image/png" sizes="32x32" href="assets/favicon-gunmetal/favicon-32.png" />
<link rel="apple-touch-icon" href="assets/favicon-gunmetal/apple-touch-icon-180.png" />
```

Notes:
- Remove the existing `assets/favicon.svg` (cyan play-triangle) reference so it doesn't override this one.
- Add `?v=2` to each href to bust browser caches when switching over.
- Colors: background `#2A2F36`, glyph `#E8EBEE`.
