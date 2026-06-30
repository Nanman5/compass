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

import { spawn } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

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
    return ingestLink(input.url.trim());
  }
  const t = (input.content ?? "").trim();
  if (!t) throw new IngestError("Add something to personalize — paste text, a link, or a screenshot.");
  // A bare URL pasted into the text box → treat it as a link.
  if (URL_RE.test(t)) {
    return ingestLink(t);
  }
  return { text: t.slice(0, MAX_INGEST_CHARS), kind: "text", sourceLabel: "what you pasted" };
}

/**
 * A pasted link. For social VIDEO posts (reels, TikToks, Shorts) the real advice is usually
 * SPOKEN, so we download the clip and let Gemini watch+listen — far richer than the caption.
 * Falls back to the caption (oEmbed) and then plain HTML when the download is blocked (e.g. a
 * login-gated Instagram reel), and finally to a clear "screenshot it" nudge.
 */
async function ingestLink(url: string): Promise<Ingested> {
  // Instagram reels need Meta Developer Program access we've applied for but don't have yet.
  // Say so plainly instead of failing — TikTok/YouTube links and screenshots work today.
  if (isInstagram(url)) {
    throw new IngestError(
      "Instagram reels aren't supported just yet — we're waiting on access to the Meta Developer Program to read them. For now, paste a TikTok or YouTube link, or tap “Screenshot or clip” and I'll read it from there.",
    );
  }
  if (isVideoHost(url)) {
    try {
      const media = await downloadVideoFromLink(url);
      return { text: await readMedia(media, "video"), kind: "video", sourceLabel: "that video" };
    } catch (err) {
      // Download blocked or vision unavailable → try the caption before giving up.
      const caption = await tryOEmbed(url).catch(() => null);
      if (caption) return { text: caption.slice(0, MAX_INGEST_CHARS), kind: "link", sourceLabel: "that video's caption" };
      if (isHardBlockedSocial(url)) {
        throw new IngestError(
          "Instagram blocks reading reels from a link. Tap “Screenshot or clip” and I'll read it straight from there — I can even hear the audio.",
        );
      }
      if (err instanceof IngestError) throw err;
      // Generic host that just wasn't a video → fall through to HTML text.
    }
  }
  return { text: await fetchUrlText(url), kind: "link", sourceLabel: "that link" };
}

/** Instagram links — gated behind Meta API access we don't have yet (handled with a clear note). */
function isInstagram(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return host === "instagram.com" || host.endsWith(".instagram.com");
  } catch {
    return false;
  }
}

/** Hosts whose links are usually short videos worth downloading + watching with Gemini. */
function isVideoHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return ["instagram.com", "tiktok.com", "youtube.com", "youtu.be", "facebook.com", "fb.watch"].some(
      (h) => host === h || host.endsWith(`.${h}`),
    );
  } catch {
    return false;
  }
}

/**
 * Download a social video with yt-dlp (capped small enough for Gemini's inline limit) and
 * return it as base64. yt-dlp + ffmpeg must be on PATH — present in the Docker image; override
 * the binary with YT_DLP_PATH. Throws (caught by the caller) when a post is private/login-gated.
 */
async function downloadVideoFromLink(url: string): Promise<{ data: string; mimeType: string }> {
  const dir = await mkdtemp(path.join(tmpdir(), "compass-dl-"));
  try {
    await runYtDlp([
      "-q", "--no-warnings", "--no-playlist", "--socket-timeout", "20",
      "--max-filesize", "18M",
      // Prefer a small (<=480p) mp4; merge with ffmpeg if needed.
      "-S", "res:480,ext:mp4:m4a", "--merge-output-format", "mp4",
      "-o", path.join(dir, "v.%(ext)s"),
      url,
    ]);
    const files = (await readdir(dir)).filter((f) => !f.startsWith("."));
    if (files.length === 0) throw new IngestError("Couldn't download that video.");
    const buf = await readFile(path.join(dir, files[0]));
    if (buf.byteLength > MAX_MEDIA_BYTES) {
      throw new IngestError("That video's a bit long to read in one go — try a shorter clip or a screenshot.");
    }
    return { data: buf.toString("base64"), mimeType: "video/mp4" };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function runYtDlp(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.env.YT_DLP_PATH || "yt-dlp", args, {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr?.on("data", (d: Buffer) => (stderr += d.toString()));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(stderr.slice(0, 400) || `yt-dlp exited ${code}`)),
    );
  });
}

/* ───────────────────────────────────────── link */

/** A real browser; a link-preview crawler (Instagram/X expose Open Graph caption to these). */
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";
const CRAWLER_UA = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";
/** Minimum chars to consider an extraction "readable" (vs a login wall / empty shell). */
const MIN_READABLE = 40;

/**
 * Get readable text from a link, trying progressively harder so blocking sites (Instagram,
 * TikTok, X…) still yield SOMETHING instead of a dead end:
 *   1. oEmbed         — clean caption JSON for TikTok/YouTube.
 *   2. browser fetch  — normal articles.
 *   3. crawler fetch  — many social sites only emit Open Graph tags to link-preview bots.
 *   4. reader proxy   — renders the page server-side and returns plain text (last resort).
 * Only if ALL of these come back empty do we ask for a screenshot.
 */
async function fetchUrlText(url: string): Promise<string> {
  const oembed = await tryOEmbed(url);
  if (oembed) return oembed.slice(0, MAX_INGEST_CHARS);

  const attempts: string[] = [];
  for (const text of [
    await tryFetchText(url, BROWSER_UA),
    await tryFetchText(url, CRAWLER_UA),
    await tryReaderProxy(url),
  ]) {
    if (text) {
      if (text.length >= MIN_READABLE) return text.slice(0, MAX_INGEST_CHARS);
      attempts.push(text);
    }
  }

  // Nothing crossed the readable bar — return the longest scrap if we got one, else a clear error.
  const best = attempts.sort((a, b) => b.length - a.length)[0];
  if (best && best.length > 0) return best.slice(0, MAX_INGEST_CHARS);

  // Instagram / X hard-block link reading (no OG, no oEmbed without a token). Don't pretend —
  // point the parent to the path that DOES work for a reel: a screenshot or the clip itself,
  // which Compass reads (and can even hear the audio of) with vision.
  if (isHardBlockedSocial(url)) {
    throw new IngestError(
      "Instagram blocks reading reels from a link. Tap “Screenshot or clip” and I'll read it straight from there — I can even hear the audio.",
    );
  }
  throw new IngestError(
    "That page didn't have readable text (some sites block it). Try a screenshot or paste the text.",
  );
}

/** Hosts that wall server-side reading entirely, so a bare link can't be made to work. */
function isHardBlockedSocial(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return ["instagram.com", "x.com", "twitter.com", "facebook.com", "threads.net"].some(
      (h) => host === h || host.endsWith(`.${h}`),
    );
  } catch {
    return false;
  }
}

/** Fetch a page with a given UA and pull readable text from it. Returns null on any failure. */
async function tryFetchText(url: string, userAgent: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "user-agent": userAgent, accept: "text/html,application/xhtml+xml" },
    });
    if (!res.ok) return null;
    const ctype = res.headers.get("content-type") || "";
    if (!ctype.includes("html") && !ctype.includes("text")) return null;
    return htmlToText(await res.text()).trim() || null;
  } catch {
    return null;
  }
}

/**
 * Last resort: a public reader proxy that renders the page (JS included) and returns clean
 * text — gets captions out of pages that hard-block scraping. Only the (public) link is sent.
 * Returns null on any failure so the caller falls through to "try a screenshot".
 */
async function tryReaderProxy(url: string): Promise<string | null> {
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { accept: "text/plain", "x-respond-with": "text" },
    });
    if (!res.ok) return null;
    return (await res.text()).replace(/\s+/g, " ").trim() || null;
  } catch {
    return null;
  }
}

/**
 * For social video platforms (TikTok, YouTube/Shorts), the public oEmbed endpoint returns
 * the post's caption/title as JSON without bot-blocking. Returns null for everything else
 * (and on any failure) so the caller falls back to normal HTML fetching.
 */
async function tryOEmbed(url: string): Promise<string | null> {
  let host: string;
  try {
    host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
  let endpoint: string | null = null;
  if (host.endsWith("tiktok.com")) endpoint = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
  else if (host.endsWith("youtube.com") || host === "youtu.be")
    endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
  if (!endpoint) return null;

  try {
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) return null;
    const data = (await res.json()) as { title?: string; author_name?: string };
    const parts = [data.title, data.author_name ? `(by ${data.author_name})` : ""].filter(Boolean);
    const text = parts.join(" ").trim();
    if (text.length < 8) {
      throw new IngestError(
        "That video's caption was too short to read. Download the clip and add it with “Screenshot or clip”, or paste the advice text.",
      );
    }
    return `Caption from the video the parent saw: ${text}`;
  } catch (err) {
    if (err instanceof IngestError) throw err;
    return null; // network/parse hiccup → fall back to HTML fetch
  }
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
