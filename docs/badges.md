# Badges

Add a docs.plus badge to your own README and link it to [docs.plus](https://docs.plus). This page lists the five styles and the code to paste.

## Styles

| Style         | Size      | Preview                                                                     | File                               |
| ------------- | --------- | --------------------------------------------------------------------------- | ---------------------------------- |
| Default       | 85×20     | ![docs.plus](../apps/webapp/public/badges/badge-docsplus.svg)               | `badge-docsplus.svg`               |
| Light         | 85×20     | ![docs.plus](../apps/webapp/public/badges/badge-docsplus-light.svg)         | `badge-docsplus-light.svg`         |
| Dark          | 85×20     | ![docs.plus](../apps/webapp/public/badges/badge-docsplus-dark.svg)          | `badge-docsplus-dark.svg`          |
| Flat-square   | 85×20     | ![docs.plus](../apps/webapp/public/badges/badge-docsplus-flat-square.svg)   | `badge-docsplus-flat-square.svg`   |
| For-the-badge | 130.25×28 | ![docs.plus](../apps/webapp/public/badges/badge-docsplus-for-the-badge.svg) | `badge-docsplus-for-the-badge.svg` |

Light and dark match the default.

## Usage

**Markdown:**

```markdown
[![docs.plus](https://docs.plus/badges/badge-docsplus.svg)](https://docs.plus)
```

**HTML:**

```html
<a href="https://docs.plus">
  <picture>
    <source
      media="(prefers-color-scheme: dark)"
      srcset="https://docs.plus/badges/badge-docsplus-dark.svg" />
    <img alt="docs.plus" height="20" src="https://docs.plus/badges/badge-docsplus.svg" />
  </picture>
</a>
```

The HTML form shows the dark badge when the reader's system uses a dark theme. Set `height="28"` on `badge-docsplus-for-the-badge.svg`.

For a README that npm shows, use the Markdown form. npm removes `<picture>`, and a click on the badge then opens the image instead of your link.
