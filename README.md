# docs-builder

The `docs-builder` tool takes your Markdown documentation files and generates a
static website that can easily be:
* previewed locally on your machine, and
* deployed on any server

It has no server-side dependencies (including for search, which is purely
client-side), so the generated docs can be previewed on localhost with a
complete live-reload experience for fast development.

_What you see locally is exactly the same as what you see when the docs are
deployed to a server._

## Why does this exist?

At [Climate Interactive](https://www.climateinteractive.org), we use `docs-builder` to
generate our user-facing documentation, such as the
[En-ROADS User Guide](https://docs.climateinteractive.org/projects/en-roads/en/latest),
which has been translated into multiple languages.

We developed `docs-builder` because we needed precise control over how our documentation
is sliced up and made available to translators.
Existing tools like Sphinx and ReadTheDocs didn't offer the flexibility and speed we
wanted, and did not make it easy to define stable string identifiers that are essential
for maintaining translation files with services like [Weblate](https://weblate.org).

Additionally, we needed the ability to control how translations are versioned.
For example, sometimes a translator might need a couple months to update their
translation when we update the source material.
In these cases, the translator may prefer to show a complete (but slightly outdated)
version of the translation, rather than have newer (untranslated) portions
interleaved with older (translated) sections.
The `docs-builder` tool provides versioning capabilities in the config files that
allow you to version different translations individually.

There are many other static site generators out there (Hugo, Jekyll, Markdoc, etc),
but none offered exactly the right feature set that we needed.

If you're building a documentation site for only one language, those other tools
could fit the bill.
However, if you need to build high-quality documentation for multiple languages,
`docs-builder` might be what you need.

## What's in this repo?

This repo contains the [`@climateinteractive/docs-builder`](./packages/docs-builder) package, which contains
the `docs-builder` command line tool.
Check out that package's [`README`](./packages/docs-builder) for installation and usage instructions.

There is also a complete, working example in the [`examples/sample-docs`](./examples/sample-docs) directory.

## How do I get started?

Try running the [`sample-docs`](./examples/sample-docs) project in development mode:

```sh
# Install pnpm if needed
npm install -g pnpm

# Install dependencies
cd docs-builder
pnpm i

# Build and run `docs-builder` in development mode; this will start a
# local server and will open the generated docs in your browser
pnpm sample:dev
```

Once the builder is running, try editing one of the Markdown files and see your
changes appear instantaneously in the browser!

## License

`docs-builder` is distributed under the MIT license. See `LICENSE` for more details.
