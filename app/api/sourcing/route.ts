import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import type { SourcingKit, SourcingResponse } from "@/types";

export const runtime = "nodejs";

const MODEL = "claude-sonnet-5";
const MAX_TOKENS = 2000;

const GENERIC_ERROR =
  "The generator could not complete that request. Try again, or tighten the brief to a single role.";

// --- Best-effort in-memory rate limiting ----------------------------------
// KNOWN LIMITATION: Vercel Functions are stateless and horizontally scaled.
// Each running instance holds its own `hits` Map, and instances are spun up and
// torn down freely, so these counts are neither shared across instances nor
// durable across cold starts. This is deliberately best-effort: it stops casual
// scripting from one IP against a warm instance, not a determined attacker who
// can spread requests across instances or wait out a restart. Durable, accurate
// limiting would need a shared store (Vercel KV or Upstash), which is out of
// scope here.
const RATE_LIMIT = 10; // requests...
const RATE_WINDOW_MS = 3_600_000; // ...per hour, per IP
const RATE_LIMITED_MESSAGE =
  "Too many requests. Please wait a while and try again.";

// IP -> ascending list of request timestamps (ms) still inside the window.
const hits = new Map<string, number[]>();

function clientIp(request: Request): string {
  // Vercel sets x-forwarded-for as a comma-separated list "client, proxy1,
  // proxy2, ..." and overwrites any client-supplied value; the first entry is
  // the originating client.
  const first = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return first || "unknown";
}

/**
 * Records a hit for `ip` and reports whether it is now over the limit. On every
 * call it prunes expired timestamps for all IPs and deletes empty buckets, so
 * the Map stays bounded by the number of IPs active within the window.
 */
function isRateLimited(ip: string): boolean {
  const cutoff = Date.now() - RATE_WINDOW_MS;

  // Sweep every bucket so idle IPs are evicted rather than accumulating.
  // Deleting the current key or re-setting an existing one is safe during Map
  // iteration.
  for (const [key, times] of hits) {
    const recent = times.filter((t) => t > cutoff);
    if (recent.length) hits.set(key, recent);
    else hits.delete(key);
  }

  const recent = hits.get(ip) ?? [];
  // Already at the cap: reject without recording, so a blocked caller can't keep
  // pushing its own window forward and lock itself out indefinitely.
  if (recent.length >= RATE_LIMIT) return true;

  recent.push(Date.now());
  hits.set(ip, recent);
  return false;
}

const SYSTEM = `You are a principal technical sourcer building runnable sourcing intelligence for a senior technical search. The role may be in software engineering, AI/ML, cloud infrastructure, or security engineering — read the brief and tune to whichever discipline it is. You never scrape or store personal data. You produce the queries a recruiter runs themselves, plus calibration judgment.

Return ONLY valid JSON, no markdown, no preamble, matching exactly:
{
  "role": "short role label",
  "xrayQueries": [{"platform":"the venue, e.g. GitHub, arXiv, Hugging Face, CVE/NVD, Stack Overflow, or Web","query":"a google x-ray query beginning with site:","note":"one short line on what it surfaces"}],
  "booleanStrings": [{"platform":"LinkedIn Recruiter","query":"string","note":"one short line"}],
  "idealProfile": {
    "seniorSignals": ["4 concrete signals that indicate true senior/bar-raising level, not mid"],
    "midVsSenior": "one sentence naming what most cleanly separates a senior from a mid candidate for THIS role",
    "adjacentCompanies": ["4 companies or org types to source from"],
    "technicalMarkers": ["3 specific technical proofs to look for"]
  },
  "screening": {
    "rubric": [{"criterion":"string","lookFor":"one short line"}],
    "calibrationQuestions": ["3 phone-screen questions that separate depth from surface"]
  }
}

Rules: The X-ray queries are the primary output, since they reach senior engineers who leave signal off LinkedIn. Provide 3 to 4 X-ray queries on the venues where senior people in THIS discipline actually leave signal, not a fixed list: for software and infrastructure, usually GitHub and Stack Overflow; for AI/ML, prefer arXiv, Google Scholar, Papers with Code, Hugging Face, OpenReview, and Kaggle; for security, prefer GitHub, CVE/NVD and vendor advisories, HackerOne/Bugcrowd profiles, and CTF or conference write-ups; for cloud/infra, include conference talks (KubeCon, SREcon) and major project or CNCF repos. Optionally add one broader web X-ray for talks or personal sites. Each X-ray query must begin with site: and run on Google. Provide LinkedIn Boolean only if "LinkedIn Recruiter" is selected, and only 1 to 2, treated as a copy-and-paste convenience. Boolean strings must use real operators (AND, OR, NOT, quotes, parentheses). Tune everything to the seniority and stack in the brief. Rubric: exactly 3 criteria. Be specific to the brief, never generic.`;

const queryItem = {
  type: "object",
  properties: {
    platform: { type: "string" },
    query: { type: "string" },
    note: { type: "string" },
  },
  required: ["platform", "query", "note"],
  additionalProperties: false,
} as const;

/** The same contract as SYSTEM, enforced by the API rather than hoped for. */
const KIT_SCHEMA = {
  type: "object",
  properties: {
    role: { type: "string" },
    xrayQueries: { type: "array", items: queryItem },
    booleanStrings: { type: "array", items: queryItem },
    idealProfile: {
      type: "object",
      properties: {
        seniorSignals: { type: "array", items: { type: "string" } },
        midVsSenior: { type: "string" },
        adjacentCompanies: { type: "array", items: { type: "string" } },
        technicalMarkers: { type: "array", items: { type: "string" } },
      },
      required: [
        "seniorSignals",
        "midVsSenior",
        "adjacentCompanies",
        "technicalMarkers",
      ],
      additionalProperties: false,
    },
    screening: {
      type: "object",
      properties: {
        rubric: {
          type: "array",
          items: {
            type: "object",
            properties: {
              criterion: { type: "string" },
              lookFor: { type: "string" },
            },
            required: ["criterion", "lookFor"],
            additionalProperties: false,
          },
        },
        calibrationQuestions: { type: "array", items: { type: "string" } },
      },
      required: ["rubric", "calibrationQuestions"],
      additionalProperties: false,
    },
  },
  required: [
    "role",
    "xrayQueries",
    "booleanStrings",
    "idealProfile",
    "screening",
  ],
  additionalProperties: false,
} as const;

export async function POST(
  request: Request,
): Promise<NextResponse<SourcingResponse>> {
  // Rate-limit before any parsing or upstream work, so a flood from one IP is
  // turned away as cheaply as possible.
  if (isRateLimited(clientIp(request))) {
    return NextResponse.json({ error: RATE_LIMITED_MESSAGE }, { status: 429 });
  }

  // Validate the request before looking at server config, so a malformed body
  // gets a 400 rather than being masked by a missing-key 500.
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  const { brief, platforms } = (payload ?? {}) as {
    brief?: unknown;
    platforms?: unknown;
  };

  if (typeof brief !== "string" || !brief.trim()) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[sourcing] ANTHROPIC_API_KEY is not set");
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }

  const selected =
    Array.isArray(platforms) && platforms.every((p) => typeof p === "string")
      ? (platforms as string[])
      : [];

  const user = `Selected platforms: ${
    selected.join(", ") || "none"
  }.

Role brief:
${brief.trim()}`;

  const client = new Anthropic({ apiKey });

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      // Sonnet 5 runs adaptive thinking when `thinking` is omitted, and thinking
      // tokens count against max_tokens. This is a single structured extraction,
      // so keep it off: same behavior as the prototype, and a faster button.
      thinking: { type: "disabled" },
      system: SYSTEM,
      output_config: {
        format: { type: "json_schema", schema: KIT_SCHEMA },
      },
      messages: [{ role: "user", content: user }],
    });

    if (message.stop_reason === "refusal") {
      console.error("[sourcing] request refused", message.stop_details);
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 502 });
    }

    const text = message.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    const kit = JSON.parse(text) as SourcingKit;
    return NextResponse.json(kit);
  } catch (error) {
    // Everything the upstream call can tell us stays here. The client gets the
    // same opaque line regardless of whether this was auth, a rate limit, or a
    // malformed response.
    console.error("[sourcing]", error);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 502 });
  }
}
