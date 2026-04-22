# RV-Insights Homepage Design

## Goal

Design a bilingual product homepage for `RV-Insights` that borrows the visual completeness and single-page narrative style of the ScienceClaw reference site while staying honest to the current repository state and implementation boundaries.

## Constraints

- The current repository does not contain a landed frontend app. `web/` is effectively empty apart from a placeholder README.
- The homepage must prioritize `GitHub` as the primary CTA, with `Quick Start` and `Demo Preview` as secondary actions.
- Claims must be backed by the current README and server code only.
- Demo video is not available yet; placeholder preview visuals should be generated instead.
- The delivered page should be a static homepage, not a fully interactive product frontend.

## Audience

- Primary: Chinese and English speaking RISC-V developers and researchers.
- Secondary: open-source evaluators who want to quickly understand the project and visit the repository.

## Design Direction

Use a restrained technical product landing-page style:

- Borrow from the reference site's strengths: strong hero, clean narrative, card-based value explanation, polished one-page rhythm.
- Avoid copying its excesses: too many sections, heavy video reliance, overly broad marketing framing.
- Present `RV-Insights` as a focused engineering product rather than a generic AI assistant.

## Information Architecture

1. `Hero`
   - Bilingual product title and subtitle
   - Three CTAs: `View on GitHub`, `Quick Start`, `Demo Preview`
   - Right-side layered preview visuals instead of video
2. `Proof Strip`
   - Short trust-building labels backed by code/docs:
   - `RISC-V Expert QA`
   - `Private RAG Workflow`
   - `Real-Time Web Retrieval`
   - `Chroma / Milvus`
   - `Multi-LLM Integration`
   - `Docker Deployment Support`
3. `Core Value`
   - Four cards:
   - `RISC-V Expert Q&A`
   - `Private Knowledge Retrieval`
   - `Web-Enhanced Answers`
   - `Flexible Infra Stack`
4. `Architecture`
   - A code-backed diagram showing the real runtime path:
   - `User Query -> RVAgent -> rag_search -> Retriever -> Chroma/Milvus -> Chat/LLM`
   - Secondary offline ingestion path:
   - `PDF -> Chunking -> Embeddings -> Vector DB`
5. `Workflow`
   - Product-level answer-generation flow:
   - `User Query -> Agent Decision -> RAG Search -> Context Assembly -> Answer Generation`
6. `Capabilities`
   - Six cards:
   - `ISA Explanation`
   - `Debugging Support`
   - `Environment Guidance`
   - `Markdown / PDF Ingestion`
   - `RAG Pipeline`
   - `Evaluation & Deployment`
7. `Quick Start`
   - Minimal install steps drawn from the repository
   - Repository link repeated for conversion
8. `Demo Preview`
   - Static concept visuals labeled as preview placeholders
9. `Footer`
   - Project identity, GitHub, MIT license, bilingual switch

## Visual System

### Tone

`Calm, lightweight, and engineering-trustworthy`

### Color

- Primary accent: deep RISC-V-inspired red
- Supporting accents: steel/slate blue
- Base: warm white and slate gray

The red should be used sparingly for emphasis, not as a large saturated background field.

### Typography

- Chinese: `Noto Sans SC`
- English: `Inter`
- Monospace: system monospace for proofs, commands, and code snippets

### Layout

- Single-page flow with clear section boundaries
- Strong hero and architecture sections
- Documentation-like clarity for capability and quick-start sections
- Moderate corner radius, lighter shadows than the reference site, clearer borders

### Texture and Motion

- Light background with subtle red/blue blurred blobs
- Minimal glass surfaces
- Optional faint grid texture
- Motion limited to:
  - intro fade-in
  - card hover lift
  - gentle diagram highlight
  - smooth anchor scrolling

## Copy Strategy

The homepage copy should sound like a disciplined open-source technical product, not a broad AI marketing page.

### Supported positioning

- Intelligent Q&A and retrieval system for RISC-V
- Covers domain Q&A, private knowledge retrieval, and real-time web retrieval
- Flexible model and vector database integration
- Supports Markdown/PDF knowledge ingestion and Docker deployment

### Unsupported positioning to avoid

- Claims of a full online platform
- Claims of production readiness
- Claims of a finished frontend console
- Invented metrics or adoption numbers

## Generated Assets

### Required

1. One architecture diagram
2. One answer-generation workflow diagram
3. Three preview placeholder visuals
4. Lightweight card/icon visual tokens

### Boundaries

Allowed:

- Concept visuals
- Architecture diagrams
- Workflow diagrams
- Preview mock scenes

Not allowed:

- Fake screenshots of a shipped product
- Fake admin consoles or dashboards
- Fake API or backend service topology not present in code

## File Layout

- `web/index.html`
- `web/styles.css`
- `web/app.js`
- `web/assets/brand/`
- `web/assets/diagrams/`
- `web/assets/previews/`

## Delivery Scope

This version should include:

- Static homepage
- Responsive layout
- Bilingual toggle
- Generated diagrams and preview visuals
- Basic motion and interaction polish

This version should not include:

- Real demo video
- Live chat experience
- Frontend application shell
- Backend integration

## Implementation Notes

- The page should be easy to migrate into a future Vue/Vite setup.
- Assets should prefer SVG for portability and repository friendliness.
- The architecture and workflow diagrams must stay aligned with:
  - `server/rv_agent.py`
  - `server/rag/rag.py`
  - `server/rag/vector_db.py`
  - `server/rag/pdf_handler.py`
  - `server/settings.py`
