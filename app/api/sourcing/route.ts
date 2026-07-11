import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import type { SourcingKit, SourcingResponse } from "@/types";

export const runtime = "nodejs";

const MODEL = "claude-sonnet-5";
const MAX_TOKENS = 2000;

const GENERIC_ERROR =
  "The generator could not complete that request. Try again, or tighten the brief to a single role.";

const SYSTEM = `You are a principal technical sourcer building runnable sourcing intelligence for a SENIOR SDE search. You never scrape or store personal data. You produce the queries a recruiter runs themselves, plus calibration judgment.

Return ONLY valid JSON, no markdown, no preamble, matching exactly:
{
  "role": "short role label",
  "xrayQueries": [{"platform":"GitHub | Stack Overflow | Web","query":"a google x-ray query beginning with site:","note":"one short line on what it surfaces"}],
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

Rules: The X-ray queries are the primary output, since they reach senior engineers who leave signal off LinkedIn. Provide 3 to 4 X-ray queries covering the selected code and Q&A platforms (GitHub, Stack Overflow), and optionally one broader web X-ray for talks or personal sites. Each X-ray query must begin with site: and run on Google. Provide LinkedIn Boolean only if "LinkedIn Recruiter" is selected, and only 1 to 2, treated as a copy-and-paste convenience. Boolean strings must use real operators (AND, OR, NOT, quotes, parentheses). Tune everything to the seniority and stack in the brief. Rubric: exactly 3 criteria. Be specific to the brief, never generic.`;

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
    selected.join(", ") || "LinkedIn Recruiter, GitHub, Stack Overflow"
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
