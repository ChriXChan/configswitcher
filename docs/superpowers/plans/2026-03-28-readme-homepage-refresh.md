# README Homepage Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh the Chinese and English README files into a more polished GitHub-facing project homepage while keeping usage and release information accurate.

**Architecture:** Update only documentation files. Keep the Chinese and English READMEs aligned in structure, reuse the existing screenshots, and verify that documentation changes do not break package build or tests.

**Tech Stack:** Markdown, npm scripts, TypeScript project metadata

---

### Task 1: Refresh the Chinese README homepage

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Restructure the homepage content**
- [ ] **Step 2: Add a stronger opening section with project value and quick actions**
- [ ] **Step 3: Reorder screenshots, shortcuts, and workflow explanations for GitHub readers**

### Task 2: Refresh the English README homepage

**Files:**
- Modify: `README.en.md`

- [ ] **Step 1: Mirror the Chinese README structure in English**
- [ ] **Step 2: Keep terminology consistent with the product behavior**
- [ ] **Step 3: Preserve screenshot links and CLI examples**

### Task 3: Verify release readiness

**Files:**
- Modify: `README.md`
- Modify: `README.en.md`

- [ ] **Step 1: Run `npm test`**
- [ ] **Step 2: Run `npm run build`**
- [ ] **Step 3: Inspect git diff for clean documentation-only changes**
