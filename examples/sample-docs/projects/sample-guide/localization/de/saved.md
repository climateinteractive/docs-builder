<!-- BEGIN-PAGE[index.md] -->

# <a name="index"></a>Muster-Benutzerhandbuch<a class="heading-link" href="#index">&#128279;</a>

Dies ist die Indexseite für den Beispielleitfaden, der verwendet wird, um das Tool `docs-builder` zu demonstrieren.

Das `docs-builder` Tool wird von [Climate Interactive](http://www.climateinteractive.org/) entwickelt.

_Diese Seite wurde von [`docs-builder`](https://github.com/climateinteractive/docs-builder) erstellt._

<!-- reference-style link targets -->

<!-- END-PAGE -->

<!-- BEGIN-PAGE[content/page_1.md] -->

# <a name="page_1"></a>Seite 1<a class="heading-link" href="#page_1">&#128279;</a>

Dies ist die erste [Seite](glossary:page).

## <a name="page_1__examples"></a>Beispiele<a class="heading-link" href="#page_1__examples">&#128279;</a>

Dies ist ein Satz mit **fettem** und _kursivem_ Text.

(TODO: Deutsch) This block has two paragraphs that are captured using a `begin-def` / `end-def` pair.



(TODO: Deutsch) Use `def[hidden]` to define some text without making it appear, then &quot;use&quot; it later on the page (like this: _dieser Text wurde mit "hidden" Flag definiert_).

Dieser Text wurde in `common.md` definiert.

Dieser Satz bezieht sich auf eine Fußnote. footnote-ref:fn_example

| Person | Alter |
|--|--|
| Alice | 42 |
| Bob | 99 |

```js
// This is a code block
const one = 1
const two = 2
const answer = one + two
```

## <a name="page_1__footnotes"></a>Fußnoten<a class="heading-link" href="#page_1__footnotes">&#128279;</a>

footnote:fn_example This is a footnote (only in English for now).

_Diese Seite wurde von [`docs-builder`](https://github.com/climateinteractive/docs-builder) erstellt._

<!-- END-PAGE -->

<!-- BEGIN-PAGE[content/page_2.md] -->

# <a name="page_2"></a>Seite 2<a class="heading-link" href="#page_2">&#128279;</a>

Dies ist die zweite [Seite](glossary:page).

(TODO: Deutsch) This block has two paragraphs that are captured using a `begin-def` / `end-def` pair.

## <a name="page_2__examples"></a>Beispiele<a class="heading-link" href="#page_2__examples">&#128279;</a>

Dieser Text wurde in `common.md` definiert.

_Diese Seite wurde von [`docs-builder`](https://github.com/climateinteractive/docs-builder) erstellt._

<!-- END-PAGE -->

<!-- BEGIN-PAGE[content/glossary.md] -->

# <a name="glossary"></a>Glossar<a class="heading-link" href="#glossary">&#128279;</a>

<a name="glossary__page"></a>**Seite**: (TODO: Deutsch) one side of a sheet of paper in a collection of sheets bound together

<!-- END-PAGE -->

