/**
 * Research / web tools — Perplexity/Manus-style fetch + optional Tavily search.
 * SSRF-hardened fetch for public URLs only.
 */

const MAX_BYTES = 450_000;
const MAX_TEXT_CHARS = 80_000;
const FETCH_TIMEOUT_MS = 18_000;

function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h === "0.0.0.0") return true;
  if (h.endsWith(".local")) return true;
  if (h.endsWith(".internal")) return true;
  // IPv4 literal checks
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
  }
  return false;
}

function htmlToText(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TEXT_CHARS);
}

export function createResearchTools() {
  return {
    "research.fetchUrl": async (args: Record<string, unknown>) => {
      const urlRaw = String(args.url ?? "").trim();
      if (!urlRaw) throw new Error("Missing url");
      let url: URL;
      try {
        url = new URL(urlRaw.startsWith("http") ? urlRaw : `https://${urlRaw}`);
      } catch {
        throw new Error("Invalid URL");
      }
      if (!["http:", "https:"].includes(url.protocol)) throw new Error("Only http(s) URLs allowed");
      if (isBlockedHost(url.hostname)) throw new Error("URL host not allowed (private/local blocked)");

      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        const res = await fetch(url.toString(), {
          signal: controller.signal,
          headers: {
            "User-Agent": "ClawsResearch/1.0 (local agent; +https://github.com/claws)",
            Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
          },
          redirect: "follow",
        });
        clearTimeout(t);
        const ct = res.headers.get("content-type") ?? "";
        const buf = await res.arrayBuffer();
        if (buf.byteLength > MAX_BYTES) {
          return {
            ok: true,
            url: url.toString(),
            status: res.status,
            truncated: true,
            note: `Body exceeded ${MAX_BYTES} bytes; use browser.extract for heavy pages.`,
            text: "",
          };
        }
        const textDecoder = new TextDecoder("utf-8", { fatal: false });
        let raw = textDecoder.decode(buf);
        let title: string | undefined;
        const titleMatch = /<title[^>]*>([^<]*)<\/title>/i.exec(raw);
        if (titleMatch) title = titleMatch[1].trim().slice(0, 200);

        let text: string;
        if (ct.includes("html") || raw.trimStart().startsWith("<")) {
          text = htmlToText(raw);
        } else {
          text = raw.slice(0, MAX_TEXT_CHARS);
        }

        return {
          ok: res.ok,
          url: url.toString(),
          status: res.status,
          contentType: ct.split(";")[0]?.trim(),
          title,
          text,
          truncated: text.length >= MAX_TEXT_CHARS - 10,
        };
      } catch (e) {
        clearTimeout(t);
        const msg = e instanceof Error ? e.message : String(e);
        return { ok: false, url: urlRaw, error: msg };
      }
    },

    "research.webSearch": async (args: Record<string, unknown>) => {
      const query = String(args.query ?? "").trim();
      if (!query) throw new Error("Missing query");
      const key = process.env.TAVILY_API_KEY;
      if (!key) {
        return {
          ok: false,
          error:
            "TAVILY_API_KEY not set. Add it in Settings → env for web search, or use research.fetchUrl on known URLs.",
          hint: "https://tavily.com",
        };
      }
      try {
        const res = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: key,
            query,
            search_depth: "basic",
            max_results: Math.min(8, Math.max(3, Number(args.maxResults) || 5)),
            include_answer: true,
          }),
          signal: AbortSignal.timeout(25_000),
        });
        const data = (await res.json()) as {
          answer?: string;
          results?: Array<{ title?: string; url?: string; content?: string }>;
        };
        if (!res.ok) {
          return { ok: false, error: `Tavily ${res.status}`, query };
        }
        return {
          ok: true,
          query,
          answer: data.answer ?? "",
          results: (data.results ?? []).map((r) => ({
            title: r.title,
            url: r.url,
            snippet: (r.content ?? "").slice(0, 500),
          })),
        };
      } catch (e) {
        return { ok: false, query, error: e instanceof Error ? e.message : String(e) };
      }
    },
  };
}
