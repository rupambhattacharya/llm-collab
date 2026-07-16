---
name: review-mr
description: Review Github Merge Requests for code quality, architecture violations, and project conventions
user-invocable: true
argument-hint: "<MR_NUMBER>"
---

# Review Github Merge Request

Review an MR from this Github project. Analyze the diff for bugs, architecture violations, and adherence to project conventions.

## Usage

```
/review-mr <MR_NUMBER>
```

If no MR number is provided, review the current branch's MR.

## How to Fetch MR Data

```bash
# Fetch latest and diff against target branch
git fetch origin
git diff origin/master...HEAD
```

## Review Checklist

### Architecture & Domain Layering (Critical)

- [ ] **shared-domains CANNOT import from core-domains** — this is the foundational invariant
- [ ] Import paths respect the layer hierarchy: `shared-domains` -> `core-domains`
- [ ] New stores follow the pattern: domain interface + infrastructure implementation
- [ ] Controllers only orchestrate via event bus, stores, and use cases
- [ ] Use cases represent single business operations


### Bundle Size

- [ ] Changes should not significantly increase bundle size (max gate: **1200 KB**)
- [ ] No unnecessary new dependencies added
- [ ] Check if large libraries are imported fully vs tree-shaken

### Testing

- [ ] New logic has corresponding `*.test.ts` files co-located with source
- [ ] Tests use Mocha + Chai + Sinon (project standard)
- [ ] Coverage must meet 70% threshold (statements, branches, functions, lines)

### Code Quality

- [ ] No security vulnerabilities (XSS, injection, etc.)
- [ ] Proper error handling at system boundaries
- [ ] No unused imports or dead code introduced
- [ ] Event bus usage is decoupled and async


### Domain Context

- [ ] Correct use of ubiquitous language

## Output Format

Structure the review as:

```
## MR Review: <title>

### Summary
<1-2 sentence overview of what the MR does>

### Critical Issues
<Blocking issues that must be fixed before merge>

### Warnings
<Non-blocking concerns worth discussing>

### Suggestions
<Optional improvements>

### Verdict
APPROVE / REQUEST_CHANGES / NEEDS_DISCUSSION
```
