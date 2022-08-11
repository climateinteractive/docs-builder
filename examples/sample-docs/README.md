# sample-docs

This is an example project that demonstrates the `docs-builder` tool.

## Quick Start

### Inside the repo (using the local `docs-builder` package)

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

### Outside the repo (using the published `docs-builder` package)

```sh
# Copy this directory somewhere else
cd docs-builder
cp -rf ./examples/sample-docs /tmp

# Install dependencies
cd /tmp/sample-docs
npm install

# Run `docs-builder` in development mode; this will start a local server
# and will open the generated docs in your browser
npm run dev
```

## License

`docs-builder` is distributed under the MIT license. See `LICENSE` for more details.
