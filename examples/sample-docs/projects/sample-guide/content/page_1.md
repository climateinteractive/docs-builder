---
fragments:
  head: ['example']
---

# <!-- section:page_1 --><!-- def:title -->Page 1

<!-- def:intro -->
This is the first [page][glossary_page].

## <!-- section:examples -->:section_examples:

<!-- begin-def:example_1 -->

This is a sentence with __bold__ and _italic_ text.

This block has two paragraphs that are captured using a `begin-def` / `end-def` pair.

<!-- end-def -->

<!-- def[hidden]:hidden_text -->
this text was defined using "hidden" flag

<!-- def:example_2 -->
Use `def[hidden]` to define some text without making it appear, then "use" it later on the page (like this: _:page_1__examples__hidden_text:_).

:content_placeholder:

<!-- def:example_3 -->
This sentence refers to a footnote. footnote-ref:fn_example

| <!-- def:header_person-->person | <!-- def:header_age -->age |
|--|--|
| Alice | 42 |
| Bob | 99 |


```js
// This is a code block
const one = 1
const two = 2
const answer = one + two
```

## <!-- section:footnotes -->:section_footnotes:

footnote:fn_example This is a footnote (only in English for now).

_:github_project:_
