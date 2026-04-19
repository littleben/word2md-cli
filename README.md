# word2md-cli

[![npm](https://img.shields.io/npm/v/word2md-cli.svg)](https://www.npmjs.com/package/word2md-cli)
[![license](https://img.shields.io/npm/l/word2md-cli.svg)](LICENSE)

Convert `.docx` files to Markdown from the command line. Optional image OCR via PaddleX.

> Web version: [word2md.net](https://word2md.net) — drag & drop in browser, no install needed.

## Install

```bash
pnpm add -g word2md-cli
# or run without install
npx word2md-cli input.docx
```

## Usage

```bash
word2md input.docx                         # → input.md next to source
word2md input.docx -o out.md               # custom output
word2md input.docx --stdout                # to stdout
word2md a.docx b.docx c.docx -d out/       # batch mode
word2md input.docx --format text           # plain text (strip markdown)
```

### Image OCR

Pass `--ocr` with PaddleX credentials to extract text from images inside the docx:

```bash
export PADDLEX_OCR_URL="https://..."
export PADDLEX_OCR_TOKEN="..."
word2md input.docx --ocr
```

Or pass flags directly:

```bash
word2md input.docx --ocr \
  --paddlex-url https://... \
  --paddlex-token xxx \
  --ocr-concurrency 4
```

Without `--ocr`, images are stripped.

## Develop

```bash
pnpm install
pnpm dev -- sample.docx --stdout
pnpm build
```
