# Destiny Chart Matrix

Destiny Chart Matrix is a web-based project designed to help users explore the 22 archetypes of the Destiny Matrix system through birth-date-based calculations and educational reports.

## Project Overview

The platform aims to make the system easier to understand through structured explanations and personalized digital reports. It also provides educational documents and video presentations to help users learn the system in greater depth. The educational resources will continue to expand and evolve over time.

## Features

- Birth-date-based calculations
- Interpretations based on 22 archetypes
- Personalized digital reports
- Educational documents and learning resources
- Educational presentation videos
- Turkish and English language support

## Website

https://www.destinychartmatrix.com

## Project Status

The project and its educational resources are under ongoing development, with new learning materials planned to be added over time.

## Language URLs and search indexing

- `/` is the Turkish calculator. `/?lang=tr` is a supported alias with `/` as its canonical.
- `/?lang=en` is the English calculator, with its own canonical and sitemap entry.
- Language is determined by the URL, not saved preferences or browser language. Switching language updates the URL without reloading the calculator and preserves other query parameters and fragments.
- The calculator is client-rendered. Its early inline script creates a single language-specific canonical before third-party scripts load. Google must render JavaScript to see the English content and canonical; server-rendered language pages would remove this dependency in a future change.
- Reciprocal `hreflang` links identify Turkish and English variants. Blog articles already have self-canonicals and reciprocal language links.

Run regression checks with `node --test tests/seo.test.mjs` (Node.js 18+).

After deployment, use Search Console's live URL test for `/`, `/?lang=en` and the Turkish blog article. Verify the rendered language/canonical before requesting indexing. The Turkish `?lang=tr` alias may appropriately remain an alternate page. Successful technical checks do not guarantee indexing or a particular search position.

The HTML is kept below Google's 2 MB uncompressed crawl limit. Large literal
interpretation tables live in content-hashed `assets/matrix-data-*.js` files,
each below 900 KB, loaded in order before the application. Keep these script
references synchronous: the application expects the data to be available at
initialization. Data files must be deployed before or alongside index.html.
