# Agent Development Guide

A file for [guiding coding agents](https://agents.md/).

## Project Structure

- This is a monorepo.
- We use `pnpm` as our package manager, so always use commands like `pnpm {command}` instead of `npm {command}`.
- Common configuration files are kept in the top-level directory of this repository.
- Published packages are in the `packages` directory. Each package can be built and tested independently.

## Commands

All commands below can be run directly from the project root using pnpm's filter (-F) option.
For example, to build only `packages/docs-builder`, run `pnpm -F docs-builder build`.

- **Build:** `pnpm -F {package} build`
- **Test (all test files in the package):** `pnpm -F {package} test`
- **Test (single test file in the package):** `pnpm -F {package} test {test_file}`
- **Type-check:** `pnpm -F {package} type-check`
- **Lint**: `pnpm -F {package} lint`

## Workflow

- Always use test-driven development (TDD) practices:
  - Always write tests first (we use Vitest and put tests in `.spec.ts` files).
  - Always run the tests you write and verify that they fail.
  - DO NOT start implementing/changing code until you have proven that the tests run (but fail).
  - Begin implementing code/functions only after you have well-crafted tests.
  - Once you start implementing code, refrain from making changes to the tests.
  - If you need to make changes to the tests, ask your human first.
  - Iterate on the code until all tests are passing.
- Prefer running single tests, and not the whole test suite, for performance.
- Be sure to type-check and lint when you’re done making a series of code changes.

## Conventions

### General Conventions

- When in doubt, copy the patterns (language, structure, code comment frequency, etc) that you see in nearby files.

### File Naming Conventions

- All file and folder names should be kebab-case with all lowercase letters (or digits if necessary).
- Use a dash to separate words.
- We never use CamelCase names for file or folder names.

### Git Conventions

- NEVER push your changes to the remote repository. Never `git push` to any branch (including the `main` branch). The human will always be responsible for pushing (and pulling) changes as needed.
- When working on a large feature or change, don't put everything into a single commit.
- Always break up your work into smaller/reasonable/logical chunks.
- Implement one task at a time.
- Before you commit your changes, make sure tests are passing and type-check / lint / prettier checks are clean.
- Never include a GitHub issue number (e.g., `#123`) in commit messages (for example, do not include a `(#123)` suffix); this will just pollute the GitHub issue with unnecessary links.
- Never include a "Co-Authored-By: Claude" line in commit messages.

### Language Conventions

- This project uses [TypeScript](https://www.typescriptlang.org/) (`.ts`) syntax whenever possible.
- We always prefer TypeScript over JavaScript except in rare cases where JavaScript has been used extensively in the past.
- Make sure each new file starts with a copyright header, for example:
  ```ts
  // Copyright (c) {YEAR} Climate Interactive / New Venture Fund
  ```
- Add TSDoc comments to all interfaces, classes, methods, functions, fields (basically any declaration). See "Code Documentation Conventions" below.

### Code Documentation Conventions

- This project uses [TSDoc](https://tsdoc.org/)-style comments for documenting TypeScript code.
- Note that TSDoc is very similar to JSDoc but TSDoc is more standard for TypeScript code.
- Add TSDoc comments to all interfaces, classes, methods, functions, fields (basically any declaration).
- Each comment should end with a period.
- Method and function comments should start with a verb without an "s" on the end, for example, "Update the record..." instead of "Updates the record...".
- Parameter declarations using `@param` should not include a "-" after the variable name, and the sentence should always end ending with a period.
- For `@returns` and `@throws`, the sentence should always start with an uppercase letter and end with a period.
- Include a blank line between the method/function comments and the first `@param` line.
