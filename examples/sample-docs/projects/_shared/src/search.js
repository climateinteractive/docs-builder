// Copyright (c) 2022 Climate Interactive / New Venture Fund

const idx = lunr.Index.load(searchIndexSerializedData)

function performSearch(rawSearchText, basePath) {
  // Remove quotes and extra whitespace from the search query
  rawSearchText = rawSearchText.replace(/['"]/g, '')
  rawSearchText = rawSearchText.trim()

  // Split the search query on whitespace and dashes (this is the same as the
  // default `lunr.tokenizer` behavior)
  const searchTextParts = rawSearchText.split(/(?:\s+|\-)/).filter(s => s.length)

  // Only include terms that contain two or more characters
  // TODO: This means a search for "C-ROADS" won't match exactly because the
  // "C" term is only one character long; "ROADS" will still match, but the
  // "C" won't be highlighted
  const significantTerms = searchTextParts.filter(t => t.length >= 2)

  // Search the index
  let searchResults
  if (significantTerms.length > 0) {
    // This is adapted from a suggestion made by the Lunr.js author for getting
    // better results for typeahead style search, see:
    //   https://github.com/olivernn/lunr.js/issues/256#issuecomment-295407852
    // Without this, certain terms would not match, e.g. "efficien".
    searchResults = idx.query(function (q) {
      for (const term of significantTerms) {
        // Look for an exact match and apply a large positive boost
        q.term(term, { usePipeline: true, boost: 100 })

        // Only include wildcard search if the term contains at least 3 characters;
        // this provides better performance than if we allowed terms with 2 characters
        if (term.length >= 3) {
          // Look for terms that match the beginning of this term and apply a medium boost.
          // Use `REQUIRED` to make multi-term searches use logical AND instead of the
          // default (logical OR).
          q.term(`${term}*`, {
            usePipeline: false,
            presence: lunr.Query.presence.REQUIRED,
            boost: 10
          })

          // Look for terms that match with an edit distance of 2 and apply a small boost
          // q.term(term, { usePipeline: false, editDistance: 2, boost: 1 })
        }
      }
    })
  } else {
    searchResults = []
  }

  const matchedStems = new Set()
  if (searchResults.length > 0) {
    // Organize the search results by page and section
    const pageResults = new Map()
    for (const result of searchResults) {
      // Add the stems that were matched in the search result
      for (const stem of Object.keys(result.matchData.metadata)) {
        matchedStems.add(stem)
      }

      // Get the text chunk that was referenced by the search result
      const chunk = searchChunkData[result.ref]

      // Add the page if we haven't seen it already
      const pageId = chunk.p.toString()
      let pageResult = pageResults.get(pageId)
      if (!pageResult) {
        const pageData = searchPageData[pageId]
        pageResult = {
          title: pageData.t,
          path: pageData.p,
          sectionResults: new Map()
        }
        pageResults.set(pageId, pageResult)
      }

      // Add the section if we haven't seen it already
      const sectionId = chunk.s ? chunk.s.toString() : '_'
      let sectionResult = pageResult.sectionResults.get(sectionId)
      if (!sectionResult) {
        const pageData = searchPageData[pageId]
        if (sectionId !== '_') {
          const sectionData = pageData.s[sectionId]
          sectionResult = {
            title: sectionData.t,
            anchor: sectionData.a,
            chunks: []
          }
        } else {
          sectionResult = {
            chunks: []
          }
        }
        pageResult.sectionResults.set(sectionId, sectionResult)
      }

      // Add the chunk to the section.  If the matched text is from a heading, we don't
      // need to add it because we already display the parent section.
      if (chunk.h !== true) {
        sectionResult.chunks.push(chunk.t)
      }
    }

    function link(href, text) {
      return `<a href="${href}" onclick="onSearchResultLinkClicked();">${text}</a>`
    }

    // Emit HTML for the results
    const resultParts = []
    for (const pageResult of pageResults.values()) {
      const pagePath = `${basePath}/${pageResult.path}`
      resultParts.push('<hr/>')
      resultParts.push(`<h2>${link(pagePath, pageResult.title)}</h2>`)
      for (const sectionResult of pageResult.sectionResults.values()) {
        if (sectionResult.title) {
          resultParts.push(
            `<h3>${link(`${pagePath}${sectionResult.anchor}`, sectionResult.title)}</h3>`
          )
        }
        // Show up to two chunks per section
        const numChunks = Math.min(sectionResult.chunks.length, 2)
        for (let i = 0; i < numChunks; i++) {
          const chunk = sectionResult.chunks[i]
          resultParts.push(`<p>${chunk}</p>`)
        }
      }
    }

    // Show the search results
    const searchResultsElem = document.getElementById('search-results-content')
    searchResultsElem.innerHTML = resultParts.join('\n')

    // Highlight matches
    if (matchedStems.size > 0) {
      const marker = new Mark(searchResultsElem)
      // Use "complementary" mode to highlight the whole word if a stem matches only a
      // part of that word
      marker.mark([...matchedStems], { accuracy: 'complementary' })
    }
  }

  function setElemVisible(elem, visible) {
    elem.style.display = visible ? 'unset' : 'none'
  }

  // Show the correct content for the search results container
  const hasResults = searchResults.length > 0
  setElemVisible(document.getElementById('search-results-content'), hasResults)
  setElemVisible(document.getElementById('search-results-empty'), !hasResults)

  // Show the search results only when the search field is non-empty
  const showResults = searchTextParts.length > 0
  setElemVisible(document.getElementById('content'), !showResults)
  setElemVisible(document.getElementById('search-results-container'), showResults)
}
