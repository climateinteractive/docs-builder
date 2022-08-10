# @climateinteractive/docs-builder

This package provides a command line tool that can generate a static website
that contains user-facing documentation.

It takes Markdown source files and produces a site that is similar in
design to ReadTheDocs.

It has no server-side dependencies (including for search, which is purely
client-side), so the generated docs can be tested easily on localhost.

The Markdown files can contain special tags that provide precise control over
how blocks of text are made available for translation.
