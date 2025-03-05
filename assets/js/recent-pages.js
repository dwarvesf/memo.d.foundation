// Recent pages handler
document.addEventListener('DOMContentLoaded', function() {
  // Initialize recent pages from localStorage or create empty array
  if (!localStorage.getItem('recentPages')) {
    localStorage.setItem('recentPages', JSON.stringify([]));
  }

  // Record current page visit
  const currentPath = window.location.pathname;
  const currentTitle = document.title;
  
  // Skip recording if this is the home page
  if (currentPath !== '/' && currentPath !== '/index.html') {
    const timestamp = new Date().getTime();
    
    // Get current page info and strip redundant title parts if present
    let pageTitle = currentTitle;
    if (pageTitle.includes(' | ')) {
      pageTitle = pageTitle.split(' | ')[0].trim();
    }

    const currentPage = {
      path: currentPath,
      title: pageTitle,
      timestamp: timestamp
    };

    // Get existing recent pages
    let recentPages = JSON.parse(localStorage.getItem('recentPages'));
    
    // Remove current page if it exists already (to avoid duplicates)
    recentPages = recentPages.filter(page => page.path !== currentPath);
    
    // Add current page to the beginning
    recentPages.unshift(currentPage);
    
    // Keep only the last 10 pages
    if (recentPages.length > 10) {
      recentPages = recentPages.slice(0, 10);
    }
    
    // Store back to localStorage
    localStorage.setItem('recentPages', JSON.stringify(recentPages));
  }

  // Create and dispatch an event when command palette is opened
  document.addEventListener('command-palette-opened', function() {
    const recentPages = JSON.parse(localStorage.getItem('recentPages'));
    const recentPagesEvent = new CustomEvent('command-palette-recents', {
      detail: { data: recentPages.slice(0, 3) } // Get only the top 3
    });
    window.dispatchEvent(recentPagesEvent);
  });
});