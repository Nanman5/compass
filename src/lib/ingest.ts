/**
 * Compass — source ingestion for Paste & Personalize.
 *
 * Turns whatever a parent throws at us into plain advice text the personalize pipeline can
 * reason over: pasted text, a LINK (article/reel — fetched + stripped), an IMAGE (a
 * screenshot of advice — read with Gemini vision), or a VIDEO/clip (transcribed with Gemini).
 *
 * Server-only: uses GEMINI_API_KEY and makes outbound fetches. Best-effort and defensive —
 * every path degrades to a clear, recoverable error rather than throwing into a 500.
 */

import "server-only";

import { GoogleGenerativeAI } from "@google/generative-ai";

/** Keep extracted text bounded so a huge article/transcript can't blow the prompt budget. */
export const MAX_INGEST_CHARS = 6_000;
/** Inline media cap (~Gemini inline request limit). Larger needs the File API — out of scope. */
const MAX_MEDIA_BYTES = 18 * 1024 * 1024;
const VISION_MODEL = process.env.INGEST_GEMINI_MODEL || "gemini-2.5-flash";
const FETCH_TIMEOUT_MS = 9_000;

export type IngestKind = "text" | "link" | "image" | "video";

export interface IngestInput {
  content?: string;
  url?: string;
  /** base64 (no data: prefix) + mime, e.g. from a screenshot upload */
  image?: { data: string; mimeType: string };
  video?: { data: string; mimeType: string };
}

export interface Ingested {
  text: string;
  kind: IngestKind;
  /** human phrase for the UI, e.g. "your screenshot", "that link" */
  sourceLabel: string;
}

export class IngestError extends Error {}

const URL_RE = /^https?:\/\/\S+$/i;

export async function ingestSource(input: IngestInput): Promise<Ingested> {
  if (input.image?.data) {
    const text = await readMedia(input.image, "image");
    return { text, kind: "image", sourceLabel: "your screenshot" };
  }
  if (input.video?.data) {
    const text = await readMedia(input.video, "video");
    return { text, kind: "video", sourceLabel: "that clip" };
  }
  if (input.url && URL_RE.test(input.url.trim())) {
    return { text: await fetchUrlText(input.url.trim()), kind: "link", sourceLabel: "that link" };
  }
  const t = (input.content ?? "").trim();
  if (!t) throw new IngestError("Add something to personalize — paste text, a link, or a screenshot.");
  // A bare URL pasted into the text box → treat it as a link.
  if (URL_RE.test(t)) {
    return { text: await fetchUrlText(t), kind: "link", sourceLabel: "that link" };
  }
  return { text: t.slice(0, MAX_INGEST_CHARS), kind: "text", sourceLabel: "what you pasted" };
}

/* ───────────────────────────────────────── link */

async function fetchUrlText(url: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        // Some sites serve thin/blocked HTML to non-browser agents.
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
        accept: "text/html,application/xhtml+xml",
      },
    });
  } catch {
    throw new IngestError("Couldn't open that link — check it's public and try again, or paste the text instead.");
  }
  if (!res.ok) {
    throw new IngestError(`That link returned an error (${res.status}). Try pasting the text instead.`);
  }
  const ctype = res.headers.get("content-type") || "";
  if (!ctype.includes("html") && !ctype.includes("text")) {
    throw new IngestError("That link isn't a readable page. Try a screenshot or paste the text.");
  }
  const html = await res.text();
  const text = htmlToText(html);
  if (text.trim().length < 40) {
    throw new IngestError("That page didn't have readable text (some sites block it). Try a screenshot or paste the text.");
  }
  return text.slice(0, MAX_INGEST_CHARS);
}

/** Pull OG title/description (great for reels/articles) + visible body text. */
function htmlToText(html: string): string {
  const meta = [metaContent(html, "og:title"), metaContent(html, "og:description"), metaContent(html, "description")]
    .filter(Boolean)
    .join(". ");
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  const decoded = decodeEntities(`${meta}. ${body}`);
  return decoded.replace(/\s+/g, " ").trim();
}

function metaContent(html: string, prop: string): string {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']`,
    "i",
  );
  const m = html.match(re) || html.match(
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`, "i"),
  );
  return m ? decodeEntities(m[1]) : "";
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/* ───────────────────────────────────────── image / video via Gemini vision */

async function readMedia(media: { data: string; mimeType: string }, kind: "image" | "video"): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new IngestError("Reading screenshots and clips isn't configured right now — paste the text instead.");

  const approxBytes = Math.floor((media.data.length * 3) / 4);
  if (approxBytes > MAX_MEDIA_BYTES) {
    throw new IngestError(
      kind === "video"
        ? "That clip is a bit big — try a shorter one (under ~18MB) or paste the transcript."
        : "That image is a bit big — try a smaller screenshot.",
    );
  }

  const prompt =
    kind === "video"
      ? "A parent saw this short video with parenting advice. Transcribe the spoken words and any on-screen text, then in one or two plain sentences say what it's telling parents to DO. Output only that — no preamble."
      : "This is a screenshot a parent saw with parenting advice (a post, caption, article, or chat). Read ALL the text in it and output the actual advice as plain text. No preamble, no description of the image — just the advice text.";

  try {
    const model = new GoogleGenerativeAI(key).getGenerativeModel({ model: VISION_MODEL });
    const result = await model.generateContent([
      { inlineData: { data: media.data, mimeType: media.mimeType } },
      { text: prompt },
    ]);
    const text = result.response.text().trim();
    if (!text) throw new IngestError("Couldn't read any advice from that — try another image or paste the text.");
    return text.slice(0, MAX_INGEST_CHARS);
  } catch (err) {
    if (err instanceof IngestError) throw err;
    throw new IngestError(
      kind === "video"
        ? "Couldn't read that clip just now — try a shorter one or paste the transcript."
        : "Couldn't read that screenshot just now — try another image or paste the text.",
    );
  }
}
