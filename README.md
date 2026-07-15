# Sourcing Query Builder

A technical recruiting tool. Describe a role in plain language (software,
AI/ML, cloud, or security) and get back runnable Google X-ray searches, an
ideal-candidate profile, a screening rubric, and a LinkedIn Boolean string.
Built on the Claude API.

It exists to reach senior engineers who leave little signal on LinkedIn. The
tool generates the searches a recruiter runs themselves; it does not scrape,
store, or process any individual's data. The venue mix is chosen per
discipline (GitHub and Stack Overflow for software, arXiv and Hugging Face for
AI/ML, CVE/NVD and HackerOne for security, and so on).

Live: https://margaretnorthup.com/tools/sourcing-query-builder/app

## Run locally

    npm install
    echo "ANTHROPIC_API_KEY=sk-ant-..." > .env.local
    npm run dev

Requires an `ANTHROPIC_API_KEY`. The Claude call runs server-side in a Next.js
route handler; the key is never exposed to the browser.

The app is served under a base path, so locally it lives at
http://localhost:3000/tools/sourcing-query-builder/app (the root path 404s by
design).

## Stack

Next.js (App Router), React, and the Anthropic SDK.
