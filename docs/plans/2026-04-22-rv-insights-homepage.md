# RV-Insights Homepage Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a bilingual static product homepage for `RV-Insights` inside `web/`, with generated SVG diagrams/previews, GitHub-first CTA, and lightweight smoke tests.

**Architecture:** Implement the homepage as a static `index.html` + `styles.css` + `app.js` bundle so it can ship immediately without introducing a frontend framework. Use repository-backed copy and SVG assets to keep the page honest to the current codebase while leaving a clean migration path to a future Vue/Vite frontend.

**Tech Stack:** HTML, CSS, vanilla JavaScript, SVG assets, Python `unittest` smoke tests

---

### Task 1: Scaffold The Static Homepage And Smoke Tests

**Files:**
- Create: `web/index.html`
- Create: `web/styles.css`
- Create: `web/app.js`
- Create: `web/tests/test_homepage_structure.py`
- Modify: `web/README.md`

**Step 1: Write the failing test**

```python
from pathlib import Path
import unittest


class HomepageStructureTest(unittest.TestCase):
    def test_core_files_exist(self):
        root = Path(__file__).resolve().parents[1]
        self.assertTrue((root / "index.html").exists())
        self.assertTrue((root / "styles.css").exists())
        self.assertTrue((root / "app.js").exists())


if __name__ == "__main__":
    unittest.main()
```

**Step 2: Run test to verify it fails**

Run: `python -m unittest web.tests.test_homepage_structure -v`
Expected: FAIL because the homepage files do not exist yet

**Step 3: Write minimal implementation**

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <title>RV-Insights</title>
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <script src="./app.js"></script>
  </body>
</html>
```

**Step 4: Run test to verify it passes**

Run: `python -m unittest web.tests.test_homepage_structure -v`
Expected: PASS

**Step 5: Commit**

```bash
git add web/index.html web/styles.css web/app.js web/tests/test_homepage_structure.py web/README.md
git commit -m "feat: scaffold RV-Insights homepage"
```

### Task 2: Add Hero, Navigation, Bilingual Toggle, And Proof Strip

**Files:**
- Modify: `web/index.html`
- Modify: `web/styles.css`
- Modify: `web/app.js`
- Modify: `web/tests/test_homepage_structure.py`

**Step 1: Write the failing test**

```python
def test_required_sections_present(self):
    html = (Path(__file__).resolve().parents[1] / "index.html").read_text(encoding="utf-8")
    for section_id in ["hero", "proof", "architecture", "workflow", "capabilities", "quickstart", "demo-preview"]:
        self.assertIn(f'id="{section_id}"', html)

def test_language_toggle_hook_present(self):
    html = (Path(__file__).resolve().parents[1] / "index.html").read_text(encoding="utf-8")
    self.assertIn('data-lang="zh"', html)
    self.assertIn("lang-toggle", html)
```

**Step 2: Run test to verify it fails**

Run: `python -m unittest web.tests.test_homepage_structure -v`
Expected: FAIL because the sections and toggle hook are not present yet

**Step 3: Write minimal implementation**

```html
<body data-lang="zh">
  <header class="site-header">
    <button id="lang-toggle" type="button">EN</button>
  </header>
  <main>
    <section id="hero"></section>
    <section id="proof"></section>
    <section id="architecture"></section>
    <section id="workflow"></section>
    <section id="capabilities"></section>
    <section id="quickstart"></section>
    <section id="demo-preview"></section>
  </main>
</body>
```

```js
const toggle = document.getElementById("lang-toggle");
toggle?.addEventListener("click", () => {
  document.body.dataset.lang = document.body.dataset.lang === "zh" ? "en" : "zh";
  toggle.textContent = document.body.dataset.lang === "zh" ? "EN" : "中文";
});
```

**Step 4: Run test to verify it passes**

Run: `python -m unittest web.tests.test_homepage_structure -v`
Expected: PASS

**Step 5: Commit**

```bash
git add web/index.html web/styles.css web/app.js web/tests/test_homepage_structure.py
git commit -m "feat: add homepage hero and bilingual shell"
```

### Task 3: Add Architecture And Workflow SVG Assets

**Files:**
- Create: `web/assets/diagrams/architecture.svg`
- Create: `web/assets/diagrams/workflow.svg`
- Modify: `web/index.html`
- Modify: `web/tests/test_homepage_structure.py`

**Step 1: Write the failing test**

```python
def test_diagram_assets_exist(self):
    root = Path(__file__).resolve().parents[1]
    self.assertTrue((root / "assets/diagrams/architecture.svg").exists())
    self.assertTrue((root / "assets/diagrams/workflow.svg").exists())
```

**Step 2: Run test to verify it fails**

Run: `python -m unittest web.tests.test_homepage_structure -v`
Expected: FAIL because the SVG files do not exist yet

**Step 3: Write minimal implementation**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 720">
  <text x="60" y="80">User Query</text>
  <text x="260" y="80">RVAgent</text>
  <text x="470" y="80">rag_search</text>
  <text x="690" y="80">Retriever</text>
  <text x="920" y="80">Chroma / Milvus</text>
</svg>
```

**Step 4: Run test to verify it passes**

Run: `python -m unittest web.tests.test_homepage_structure -v`
Expected: PASS

**Step 5: Commit**

```bash
git add web/assets/diagrams/architecture.svg web/assets/diagrams/workflow.svg web/index.html web/tests/test_homepage_structure.py
git commit -m "feat: add homepage architecture diagrams"
```

### Task 4: Add Preview Placeholder Assets

**Files:**
- Create: `web/assets/previews/preview-qa.svg`
- Create: `web/assets/previews/preview-rag.svg`
- Create: `web/assets/previews/preview-system.svg`
- Modify: `web/index.html`
- Modify: `web/styles.css`
- Modify: `web/tests/test_homepage_structure.py`

**Step 1: Write the failing test**

```python
def test_preview_assets_exist(self):
    root = Path(__file__).resolve().parents[1]
    for name in ["preview-qa.svg", "preview-rag.svg", "preview-system.svg"]:
        self.assertTrue((root / "assets/previews" / name).exists())
```

**Step 2: Run test to verify it fails**

Run: `python -m unittest web.tests.test_homepage_structure -v`
Expected: FAIL because the preview assets do not exist yet

**Step 3: Write minimal implementation**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000">
  <rect width="1600" height="1000" rx="48" fill="#f5f7fb" />
  <text x="100" y="120">RISC-V Expert Q&A Preview</text>
</svg>
```

**Step 4: Run test to verify it passes**

Run: `python -m unittest web.tests.test_homepage_structure -v`
Expected: PASS

**Step 5: Commit**

```bash
git add web/assets/previews/preview-qa.svg web/assets/previews/preview-rag.svg web/assets/previews/preview-system.svg web/index.html web/styles.css web/tests/test_homepage_structure.py
git commit -m "feat: add homepage preview assets"
```

### Task 5: Build The Full Landing Page Content And Styling

**Files:**
- Modify: `web/index.html`
- Modify: `web/styles.css`
- Modify: `web/app.js`
- Modify: `web/tests/test_homepage_structure.py`

**Step 1: Write the failing test**

```python
def test_key_copy_and_ctas_present(self):
    html = (Path(__file__).resolve().parents[1] / "index.html").read_text(encoding="utf-8")
    for text in ["View on GitHub", "Quick Start", "Demo Preview", "RISC-V", "Private RAG Workflow"]:
        self.assertIn(text, html)
```

**Step 2: Run test to verify it fails**

Run: `python -m unittest web.tests.test_homepage_structure -v`
Expected: FAIL because the final copy is not in place yet

**Step 3: Write minimal implementation**

```html
<a class="button button-primary" href="https://github.com/zcxGGmu/RV-Insights">View on GitHub</a>
<a class="button" href="#quickstart">Quick Start</a>
<a class="button" href="#demo-preview">Demo Preview</a>
```

```css
.button-primary {
  background: #9f1d20;
  color: white;
}
```

**Step 4: Run test to verify it passes**

Run: `python -m unittest web.tests.test_homepage_structure -v`
Expected: PASS

**Step 5: Commit**

```bash
git add web/index.html web/styles.css web/app.js web/tests/test_homepage_structure.py
git commit -m "feat: build RV-Insights landing page"
```

### Task 6: Polish Documentation And Final Verification

**Files:**
- Modify: `web/README.md`
- Modify: `web/tests/test_homepage_structure.py`

**Step 1: Write the failing test**

```python
def test_readme_mentions_local_preview(self):
    readme = (Path(__file__).resolve().parents[1] / "README.md").read_text(encoding="utf-8")
    self.assertIn("python -m http.server", readme)
```

**Step 2: Run test to verify it fails**

Run: `python -m unittest web.tests.test_homepage_structure -v`
Expected: FAIL because the README does not document local preview yet

**Step 3: Write minimal implementation**

```md
# RV-Insights Web

## Local Preview

```bash
python -m http.server 8000 -d web
```
```

**Step 4: Run test to verify it passes**

Run: `python -m unittest web.tests.test_homepage_structure -v`
Expected: PASS

**Step 5: Commit**

```bash
git add web/README.md web/tests/test_homepage_structure.py
git commit -m "docs: add homepage preview instructions"
```
