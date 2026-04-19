import { Command } from "commander";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { convertDocx, markdownToPlainText } from "./convert.js";
import type { PaddleXOptions } from "./ocr/paddlex.js";

const program = new Command();

program
  .name("word2md")
  .description("Convert .docx files to Markdown. Optional image OCR via PaddleX.")
  .version("0.1.0")
  .argument("<inputs...>", ".docx file(s) to convert")
  .option("-o, --output <file>", "output file (single input only)")
  .option("-d, --out-dir <dir>", "output directory for batch mode")
  .option("--ocr", "enable image OCR (requires PaddleX credentials)")
  .option("--paddlex-url <url>", "PaddleX OCR endpoint (env PADDLEX_OCR_URL)")
  .option("--paddlex-token <token>", "PaddleX token (env PADDLEX_OCR_TOKEN)")
  .option("--ocr-concurrency <n>", "parallel OCR requests", "2")
  .option("--format <fmt>", "markdown | text", "markdown")
  .option("--stdout", "write to stdout instead of a file")
  .action(async (inputs: string[], opts) => {
    try {
      const ocr = resolveOcrOptions(opts);
      if (opts.ocr && !ocr) {
        exitErr("--ocr requires --paddlex-url and --paddlex-token (or env vars).");
      }

      const outDir = opts.outDir ? resolve(opts.outDir) : null;
      if (outDir) await mkdir(outDir, { recursive: true });

      if (inputs.length > 1 && opts.output) {
        exitErr("-o/--output only works with a single input. Use -d for batch.");
      }

      for (const input of inputs) {
        const abs = resolve(input);
        await ensureDocx(abs);
        process.stderr.write(`→ ${basename(abs)}\n`);

        const buf = await readFile(abs);
        let md = await convertDocx(buf, {
          ocr,
          ocrConcurrency: Number(opts.ocrConcurrency) || 2,
        });
        if (opts.format === "text") md = markdownToPlainText(md);

        if (opts.stdout) {
          process.stdout.write(md + "\n");
          continue;
        }

        const outPath = resolveOutputPath(abs, opts.output, outDir);
        await mkdir(dirname(outPath), { recursive: true });
        await writeFile(outPath, md, "utf8");
        process.stderr.write(`  ✓ ${outPath}\n`);
      }
    } catch (e: any) {
      exitErr(e?.message ?? String(e));
    }
  });

program.parseAsync(process.argv);

function resolveOcrOptions(opts: any): PaddleXOptions | null {
  if (!opts.ocr) return null;
  const url = opts.paddlexUrl || process.env.PADDLEX_OCR_URL;
  const token = opts.paddlexToken || process.env.PADDLEX_OCR_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

async function ensureDocx(abs: string) {
  const ext = extname(abs).toLowerCase();
  if (ext !== ".docx") {
    throw new Error(`Only .docx supported (got ${ext || "no ext"}): ${abs}`);
  }
  try {
    const s = await stat(abs);
    if (!s.isFile()) throw new Error(`Not a file: ${abs}`);
  } catch {
    throw new Error(`File not found: ${abs}`);
  }
}

function resolveOutputPath(input: string, output: string | undefined, outDir: string | null) {
  if (output) return resolve(output);
  const base = basename(input, extname(input)) + ".md";
  if (outDir) return join(outDir, base);
  return join(dirname(input), base);
}

function exitErr(msg: string): never {
  process.stderr.write(`word2md: ${msg}\n`);
  process.exit(1);
}
