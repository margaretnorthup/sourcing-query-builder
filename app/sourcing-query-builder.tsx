"use client";

import React, { useState, type ReactNode } from "react";
import {
  Search,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  Terminal,
  Target,
  ClipboardList,
  ShieldCheck,
  Zap,
} from "lucide-react";
import type { SourcingKit, SourcingResponse } from "@/types";

// Palette applied via inline styles, carried over from the prototype so the
// brand colors survive without arbitrary Tailwind utility values.
const C = {
  ink: "#14181E",
  paper: "#F6F7F9",
  panel: "#FFFFFF",
  line: "#E3E6EB",
  steel: "#5C6675",
  teal: "#1E5C63",
  tealSoft: "#E7F0F0",
  amber: "#B4791F",
  amberSoft: "#F7EFDD",
};

const EXAMPLE = `Senior Machine Learning Engineer, LLM systems. Owns training and inference infrastructure for large models at scale, distributed training, GPU/CUDA performance, latency and cost of production inference. Strong in PyTorch plus systems fundamentals. 6+ years shipping ML to production. Bonus: first-author papers or arXiv preprints, open-source model or framework contributions, conference talks (NeurIPS, ICML, MLSys). Fully remote, US.`;

// Only LinkedIn Recruiter gates real output (the Boolean string). X-ray venues
// are chosen by the model from the brief's discipline, per the SYSTEM Rules.
const PLATFORMS = ["LinkedIn Recruiter"];

// basePath is not applied to fetch() — only to next/link, router, and
// next/image. Keep this in sync with basePath in next.config.ts.
const BASE_PATH = "/tools/sourcing-query-builder/app";

export default function SourcingQueryBuilder() {
  const [brief, setBrief] = useState("");
  const [platforms, setPlatforms] = useState<string[]>(PLATFORMS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SourcingKit | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const togglePlatform = (p: string) =>
    setPlatforms((cur) =>
      cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p],
    );

  const copy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 1400);
    } catch {
      /* clipboard unavailable */
    }
  };

  const generate = async () => {
    if (!brief.trim()) {
      setError(
        "Add a role brief first. Describe the seniority, stack, and the signals that matter.",
      );
      return;
    }
    setError("");
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch(`${BASE_PATH}/api/sourcing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: brief.trim(), platforms }),
      });
      const data: SourcingResponse = await res.json();
      if (!res.ok || "error" in data) {
        // Surface the server's plain message (e.g. the 429 rate-limit text)
        // when present; otherwise fall back to the generic line.
        setError(
          ("error" in data && data.error) ||
            "The generator could not complete that request. Try again, or tighten the brief to a single role.",
        );
        return;
      }
      setResult(data);
    } catch {
      setError(
        "The generator could not complete that request. Try again, or tighten the brief to a single role.",
      );
    } finally {
      setLoading(false);
    }
  };

  const googleUrl = (q: string) =>
    `https://www.google.com/search?q=${encodeURIComponent(q)}`;

  return (
    <div
      style={{ background: C.paper, color: C.ink, minHeight: "100%" }}
      className="w-full"
    >
      <div className="max-w-5xl mx-auto px-5 py-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div
              className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase"
              style={{ color: C.teal }}
            >
              <Terminal size={14} /> Sourcing Intelligence
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold mt-2 leading-tight">
              Technical Sourcing Query Builder
            </h1>
            <p className="mt-2 text-sm max-w-2xl" style={{ color: C.steel }}>
              Describe the role in plain language, whether software, AI/ML,
              cloud, or security. Get runnable X-ray searches that reach senior
              engineers off LinkedIn on the venues that fit the discipline, plus
              an ideal-candidate profile, a screening rubric, and a LinkedIn
              Boolean string.
            </p>
          </div>
        </div>

        {/* Compliance note */}
        <div
          className="mt-4 flex items-start gap-2 text-xs rounded-md px-3 py-2"
          style={{ background: C.tealSoft, color: C.teal }}
        >
          <ShieldCheck size={15} className="mt-0.5 shrink-0" />
          <span>
            Generates the searches a recruiter runs themselves. It does not
            scrape, store, or process any individual&apos;s data, which keeps it
            clear of platform terms and privacy law.
          </span>
        </div>

        {/* Input panel */}
        <div
          className="mt-5 rounded-lg"
          style={{ background: C.panel, border: `1px solid ${C.line}` }}
        >
          <div className="p-4">
            <label
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: C.steel }}
            >
              Role brief
            </label>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="Senior ML engineer, LLM inference at scale, PyTorch and CUDA, 6+ years, has shipped models to production..."
              rows={5}
              className="mt-2 w-full text-sm rounded-md p-3 outline-none resize-y"
              style={{
                border: `1px solid ${C.line}`,
                background: "#FBFCFD",
                color: C.ink,
              }}
            />

            <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                {PLATFORMS.map((p) => {
                  const on = platforms.includes(p);
                  return (
                    <button
                      key={p}
                      onClick={() => togglePlatform(p)}
                      className="text-xs px-2.5 py-1 rounded-full transition-colors"
                      style={{
                        border: `1px solid ${on ? C.teal : C.line}`,
                        background: on ? C.teal : "transparent",
                        color: on ? "#fff" : C.steel,
                      }}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setBrief(EXAMPLE)}
                className="text-xs underline"
                style={{ color: C.steel }}
              >
                Load example
              </button>
            </div>

            <button
              onClick={generate}
              disabled={loading}
              className="mt-4 w-full sm:w-auto flex items-center justify-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-md transition-opacity disabled:opacity-60"
              style={{ background: C.ink, color: "#fff" }}
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Zap size={16} />
              )}
              {loading ? "Building sourcing kit..." : "Generate sourcing kit"}
            </button>

            {error && (
              <p className="mt-3 text-sm" style={{ color: "#A23A2E" }}>
                {error}
              </p>
            )}
          </div>
        </div>

        {/* Results */}
        {result && (
          <div className="mt-7 space-y-7">
            {/* Runnable X-ray searches lead */}
            <Section
              icon={<Search size={16} />}
              title="Runnable searches"
              sub="One click opens the search in Google. It surfaces public profiles; you open and judge each one."
            >
              <div className="space-y-3">
                {(result.xrayQueries || []).map((x, i) => (
                  <QueryCard
                    key={`x${i}`}
                    label={x.platform}
                    note={x.note}
                    query={x.query}
                    onCopy={() => copy(x.query, `x${i}`)}
                    copied={copied === `x${i}`}
                    runUrl={googleUrl(x.query)}
                    primary
                  />
                ))}
                {(!result.xrayQueries || result.xrayQueries.length === 0) && (
                  <p className="text-sm" style={{ color: C.steel }}>
                    No X-ray platforms selected. Turn on GitHub or Stack Overflow
                    above and generate again.
                  </p>
                )}
              </div>
            </Section>

            {/* Ideal profile */}
            {result.idealProfile && (
              <Section
                icon={<Target size={16} />}
                title="Ideal candidate profile"
                sub="What a senior bar looks like for this role."
              >
                <div className="grid sm:grid-cols-2 gap-4">
                  <Card title="Senior signals">
                    <ul className="space-y-1.5">
                      {(result.idealProfile.seniorSignals || []).map((s, i) => (
                        <li key={i} className="text-sm flex gap-2">
                          <span style={{ color: C.teal }}>&#9656;</span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                  <Card title="Technical markers">
                    <ul className="space-y-1.5">
                      {(result.idealProfile.technicalMarkers || []).map(
                        (s, i) => (
                          <li key={i} className="text-sm flex gap-2">
                            <span style={{ color: C.teal }}>&#9656;</span>
                            <span>{s}</span>
                          </li>
                        ),
                      )}
                    </ul>
                  </Card>
                  <Card title="Senior vs mid" full>
                    <p className="text-sm">{result.idealProfile.midVsSenior}</p>
                  </Card>
                  <Card title="Source from" full>
                    <div className="flex flex-wrap gap-2">
                      {(result.idealProfile.adjacentCompanies || []).map(
                        (c, i) => (
                          <span
                            key={i}
                            className="text-xs px-2 py-1 rounded"
                            style={{ background: C.amberSoft, color: C.amber }}
                          >
                            {c}
                          </span>
                        ),
                      )}
                    </div>
                  </Card>
                </div>
              </Section>
            )}

            {/* Screening */}
            {result.screening && (
              <Section
                icon={<ClipboardList size={16} />}
                title="Screening & calibration"
                sub="First-pass rubric and phone-screen questions."
              >
                <div className="grid sm:grid-cols-2 gap-4">
                  <Card title="Rubric">
                    <ul className="space-y-2">
                      {(result.screening.rubric || []).map((r, i) => (
                        <li key={i} className="text-sm">
                          <span className="font-semibold">{r.criterion}. </span>
                          <span style={{ color: C.steel }}>{r.lookFor}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                  <Card title="Calibration questions">
                    <ol className="space-y-2 list-decimal list-inside">
                      {(result.screening.calibrationQuestions || []).map(
                        (q, i) => (
                          <li key={i} className="text-sm">
                            {q}
                          </li>
                        ),
                      )}
                    </ol>
                  </Card>
                </div>
              </Section>
            )}

            {/* LinkedIn Boolean, last, as convenience */}
            {(result.booleanStrings || []).length > 0 && (
              <Section
                icon={<Copy size={16} />}
                title="LinkedIn Boolean"
                sub="A copy-and-paste convenience. Paste into LinkedIn Recruiter search, where you can iterate with live filters and result counts."
              >
                <div className="space-y-3">
                  {(result.booleanStrings || []).map((b, i) => (
                    <QueryCard
                      key={`b${i}`}
                      label={b.platform}
                      note={b.note}
                      query={b.query}
                      onCopy={() => copy(b.query, `b${i}`)}
                      copied={copied === `b${i}`}
                    />
                  ))}
                </div>
              </Section>
            )}
          </div>
        )}

        <p className="mt-10 text-xs" style={{ color: C.steel }}>
          Built by Margaret Northup &middot; Metallic Media Group
        </p>
      </div>
    </div>
  );
}

function Section({
  icon,
  title,
  sub,
  children,
}: {
  icon: ReactNode;
  title: string;
  sub?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <span style={{ color: C.teal }}>{icon}</span>
        <h2 className="text-lg font-bold">{title}</h2>
      </div>
      {sub && (
        <p className="text-xs mt-0.5 mb-3" style={{ color: C.steel }}>
          {sub}
        </p>
      )}
      {children}
    </div>
  );
}

function Card({
  title,
  children,
  full,
}: {
  title: string;
  children: ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <div
        className="rounded-lg h-full p-3.5"
        style={{ background: C.panel, border: `1px solid ${C.line}` }}
      >
        <div
          className="text-xs font-semibold uppercase tracking-wide mb-2"
          style={{ color: C.steel }}
        >
          {title}
        </div>
        {children}
      </div>
    </div>
  );
}

function QueryCard({
  label,
  note,
  query,
  onCopy,
  copied,
  runUrl,
  primary,
}: {
  label: string;
  note?: string;
  query: string;
  onCopy: () => void;
  copied: boolean;
  runUrl?: string;
  primary?: boolean;
}) {
  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        border: `1px solid ${primary ? C.teal : C.line}`,
        background: C.panel,
      }}
    >
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ borderBottom: `1px solid ${C.line}` }}
      >
        <span className="text-xs font-semibold" style={{ color: C.ink }}>
          {label}
        </span>
        <button
          onClick={onCopy}
          className="text-xs flex items-center gap-1"
          style={{ color: C.steel }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre
        className="px-3 py-2.5 text-xs whitespace-pre-wrap font-mono"
        style={{ color: C.ink }}
      >
        {query}
      </pre>
      {note && (
        <div className="px-3 text-xs" style={{ color: C.steel }}>
          {note}
        </div>
      )}
      {runUrl && (
        <div className="px-3 py-2.5">
          <a
            href={runUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md"
            style={{ background: C.teal, color: "#fff" }}
          >
            Run in Google <ExternalLink size={13} />
          </a>
        </div>
      )}
    </div>
  );
}
