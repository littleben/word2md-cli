export interface PaddleXOptions {
  url: string;
  token: string;
  concurrency?: number;
  signal?: AbortSignal;
}

export type PaddleXFileType = 0 | 1; // 0 = PDF, 1 = image

interface PaddleXResponse {
  result: {
    layoutParsingResults: Array<{
      markdown?: { text?: string };
    }>;
  };
}

export async function paddlexOcr(
  buffer: Buffer,
  fileType: PaddleXFileType,
  opts: PaddleXOptions,
): Promise<string> {
  const payload = {
    file: buffer.toString("base64"),
    fileType,
    useDocOrientationClassify: false,
    useDocUnwarping: false,
    useChartRecognition: false,
  };

  const maxAttempts = 5;
  let lastBody = "";
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const resp = await fetch(opts.url, {
      method: "POST",
      headers: {
        Authorization: `token ${opts.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: opts.signal,
    });

    if (resp.ok) {
      const data = (await resp.json()) as PaddleXResponse;
      return (data.result?.layoutParsingResults ?? [])
        .map((r) => r.markdown?.text ?? "")
        .filter(Boolean)
        .join("\n\n");
    }

    lastBody = await resp.text();
    if (resp.status === 429 && attempt < maxAttempts - 1) {
      const delay = 800 * 2 ** attempt + Math.floor(Math.random() * 400);
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }
    throw new Error(`PaddleX OCR failed (${resp.status}): ${lastBody.slice(0, 500)}`);
  }
  throw new Error(`PaddleX OCR failed after retries: ${lastBody.slice(0, 500)}`);
}
