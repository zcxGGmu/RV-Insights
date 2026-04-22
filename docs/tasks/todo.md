# RV-Insights Web Redesign Todo

## Planning
- [x] Review repository context and available frontend surface area
- [x] Inspect reference site structure and visual language
- [x] Ask clarifying question on delivery scope
- [x] Clarify audience and language strategy
- [x] Clarify homepage primary CTA and success action
- [x] Clarify available media/assets for homepage proof sections
- [x] Propose design approaches and recommendation
- [x] Present design for approval
- [x] Write approved design doc to `docs/plans/`
- [x] Write implementation plan for approved design
- [x] Execute Task 1: scaffold homepage files and smoke tests
- [x] Execute Task 2: hero shell, navigation, and bilingual toggle
- [x] Execute Task 3: architecture and workflow SVG assets
- [x] Execute Task 4: preview placeholder SVG assets
- [x] Execute Task 5: full landing page content and styling
- [x] Execute Task 6: documentation polish and final verification
- [x] Verify homepage structure and local preview instructions

## Homepage Messaging Extraction
- [x] Review `README.md` and `README_zh.md`
- [x] Cross-check repository code for supportable capability claims
- [x] Distill 3-5 homepage primary selling points
- [x] Draft capability-card content candidates
- [x] Draft stat/proof-bar content using only README/code-backed statements

## Review
- Homepage messaging distilled from README and repository code only.
- Avoided unsupported numeric claims except structure/counts directly stated by docs or code.
- Recommended direction: bilingual technical product landing page with GitHub-first CTA, architecture-driven proof, and generated placeholder visuals instead of video-first storytelling.
- Design doc saved to `docs/plans/2026-04-22-rv-insights-homepage-design.md`.
- Implementation plan saved to `docs/plans/2026-04-22-rv-insights-homepage.md`.
- Implemented static homepage in `web/` with bilingual toggle, code-backed diagrams, and three preview SVG placeholders.
- Fixed post-review issues by adding a footer language toggle and replacing the third preview with a non-topology stack overview concept.
- Verified `python -m unittest web.tests.test_homepage_structure -v` passes with 9 tests.
- Verified local preview serving via `python -m http.server 8123 -d web`, including homepage HTML and selected asset URLs.

---

# Server Architecture Analysis Todo

## Planning
- [x] Review repository context and available server surface area
- [x] Review project lessons
- [x] Inspect server runtime entrypoints and main call chain
- [x] Map implemented LLM, Embeddings, RAG, Vector DB, Agent, Retriever relationships
- [x] Distill 5-8 nodes suitable for a marketing architecture diagram
- [x] Write concise review summary

## Review
- Confirmed the implemented runtime center is `rv_agent.py`, with `test_framework.py` used as the executable demonstration path.
- Confirmed the implemented knowledge path is PDF -> chunking -> embeddings -> Chroma/Milvus -> retriever -> agent tool -> chat model.
- Excluded unlanded components from the main architecture: SQLDatabase imports are unused, no web API framework is present, and `rag.elasticsearch_db` is referenced but missing.
