// Copyright (c) 2022 Climate Interactive / New Venture Fund

let responsiveSidebarVisible = false
let firstTimeShowingSidebar = true

function setResponsiveSidebarVisible(visible) {
  if (visible === responsiveSidebarVisible) {
    return
  }

  if (visible) {
    document.body.classList.add('responsive-sidebar-visible')
    if (firstTimeShowingSidebar) {
      scrollSidebarToCurrent()
      firstTimeShowingSidebar = false
    }
  } else {
    document.body.classList.remove('responsive-sidebar-visible')
  }

  responsiveSidebarVisible = visible
}

function scrollSidebarToCurrent() {
  const currentSidebarLink = document.querySelector('.sidebar a.current')
  if (currentSidebarLink) {
    currentSidebarLink.scrollIntoView({
      behavior: 'auto',
      block: 'center',
      inline: 'start'
    })
  }
}

function onMenuButtonClicked() {
  setResponsiveSidebarVisible(!responsiveSidebarVisible)
}

function clearSearch() {
  document.getElementById('sidebar-search-input').value = ''
  onSearch('')
}

function onSearchResultLinkClicked() {
  clearSearch()
  setResponsiveSidebarVisible(false)
}

function onSectionLinkClicked() {
  setResponsiveSidebarVisible(false)
}

function positionTooltip(event) {
  const content = document.querySelector('.content-container')
  const tooltip = this.querySelector('.tooltip')
  const arrow = tooltip.querySelector('.tooltip-arrow')

  const contentRect = content.getBoundingClientRect()
  const tooltipRect = tooltip.getBoundingClientRect()
  const tooltipHalfW = tooltipRect.width / 2

  // In the case where the link text spans multiple lines, the tooltip
  // will be positioned relative to the first span by default, so we
  // choose the rect of the span that intersects the mouse location
  const linkRects = this.getClientRects()
  const firstLinkRect = linkRects[0]
  let linkRect
  const mx = event.clientX
  const my = event.clientY
  const pad = 4
  for (const r of linkRects) {
    if (mx >= r.left - pad && mx <= r.right + pad && my >= r.top - pad && my <= r.bottom + pad) {
      linkRect = r
      break
    }
  }
  if (linkRect === undefined) {
    linkRect = firstLinkRect
  }
  const linkCenterX = linkRect.left + linkRect.width / 2

  // Position the top of the tooltip below the bottom of the link text
  const ty = linkRect.bottom - firstLinkRect.bottom + linkRect.height + 8
  tooltip.style.top = `${ty}px`

  if (linkCenterX - tooltipHalfW < contentRect.left) {
    // The tooltip would go outside the left edge of the content area reposition
    // it so that it is left-aligned with the link
    const tx = linkRect.left - firstLinkRect.left + tooltipRect.width / 2
    tooltip.style.left = `${tx}px`
    arrow.style.left = `${linkRect.width / 2}px`
  } else if (linkCenterX + tooltipHalfW > contentRect.right) {
    // The tooltip would go outside the right edge of the content area reposition
    // it so that it is right-aligned with the link
    const tx = linkRect.right - firstLinkRect.right + linkRect.width - tooltipRect.width / 2
    tooltip.style.left = `${tx}px`
    arrow.style.left = `${tooltipRect.width - linkRect.width / 2}px`
  } else {
    // The tooltip is safely within the content area
    tooltip.style.left = '50%'
    arrow.style.left = '50%'
  }
}

function onWindowLoad() {
  // Keep tooltips in the visible area when they are displayed
  const links = document.querySelectorAll('.glossary-link')
  for (const link of links) {
    link.addEventListener('mouseover', positionTooltip)
  }

  // Clear the search field by default
  const searchInput = document.getElementById('sidebar-search-input')
  searchInput.value = ''
  searchInput.addEventListener('keyup', event => {
    if (event.code === 'Enter') {
      if (responsiveSidebarVisible) {
        // Remove focus from the search field (this will hide the keyboard on mobile)
        // and hide the sidebar
        document.activeElement.blur()
        setResponsiveSidebarVisible(false)
      }
    }
  })

  // Reveal the current page in the sidebar
  scrollSidebarToCurrent()
}
