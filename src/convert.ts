import mammoth from "mammoth";
import { paddlexOcr, type PaddleXOptions } from "./ocr/paddlex.js";

export interface ConvertOptions {
  ocr?: PaddleXOptions | null;
  ocrConcurrency?: number;
}

export async function convertDocx(buffer: Buffer, opts: ConvertOptions = {}): Promise<string> {
  let imgIndex = 0;
  const imageOrder: { mime: string; data: Buffer }[] = [];

  const { value: html } = await mammoth.convertToHtml(
    { buffer },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        const data = await image.read();
        imageOrder.push({ mime: image.contentType || "image/png", data: data as Buffer });
        const placeholder = `__OCR_IMG_${imgIndex++}__`;
        return { src: placeholder };
      }),
    },
  );

  let md = html
    .replace(/<h([1-6])>(.*?)<\/h\1>/g, (_m, lvl, txt) => `\n${"#".repeat(Number(lvl))} ${txt}\n`)
    .replace(/<strong>(.*?)<\/strong>/g, "**$1**")
    .replace(/<em>(.*?)<\/em>/g, "*$1*")
    .replace(/<li>(.*?)<\/li>/g, "- $1\n")
    .replace(/<\/?(ul|ol)>/g, "\n")
    .replace(/<p>(.*?)<\/p>/g, "$1\n\n")
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<img[^>]*src="(__OCR_IMG_\d+__)"[^>]*\/?>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');

  if (!opts.ocr || imageOrder.length === 0) {
    for (let i = 0; i < imageOrder.length; i++) {
      md = md.replace(`__OCR_IMG_${i}__`, "");
    }
    return md.replace(/\n{3,}/g, "\n\n").trim();
  }

  const concurrency = Math.max(1, opts.ocrConcurrency ?? 2);
  const ocrResults: string[] = new Array(imageOrder.length).fill("");
  let cursor = 0;

  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= imageOrder.length) return;
      try {
        const text = await paddlexOcr(imageOrder[i].data, 1, opts.ocr!);
        ocrResults[i] = text.trim() ? `\n\n${text.trim()}\n\n` : "";
      } catch (e: any) {
        ocrResults[i] = `\n\n_[image ${i + 1}: OCR failed: ${e?.message ?? "error"}]_\n\n`;
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, imageOrder.length) }, () => worker()),
  );

  for (let i = 0; i < ocrResults.length; i++) {
    md = md.replace(`__OCR_IMG_${i}__`, ocrResults[i]);
  }

  return md.replace(/\n{3,}/g, "\n\n").trim();
}

export function markdownToPlainText(md: string): string {
  if (!md) return "";
  let t = md;
  t = t.replace(/^#+\s+(.*)$/gm, "$1");
  t = t.replace(/(\*\*|\*|__|_)(.*?)\1/g, "$2");
  t = t.replace(/^\s*[-*+]\s+(.*)$/gm, "$1");
  t = t.replace(/^\s*\d+\.\s+(.*)$/gm, "$1");
  t = t.replace(/\[(.*?)\]\(.*?\)/g, "$1");
  t = t.replace(/!\[(.*?)\]\(.*?\)/g, "$1");
  t = t.replace(/`([^`]+)`/g, "$1");
  t = t.replace(/```[\s\S]*?```/g, "");
  t = t.replace(/^---|^\*\*\*|^___$/gm, "");
  t = t.replace(/^>\s*/gm, "");
  t = t.replace(/<[^>]*>/g, "");
  t = t.replace(/\n{3,}/g, "\n\n");
  return t.split("\n").map((l) => l.trim()).join("\n").trim();
}
