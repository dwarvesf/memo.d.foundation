Mousetrap.bind("command+shift+f", function() {
  Alpine.store("readingMode").toggle();
});

Mousetrap.bind("escape", function() {
  Alpine.store("sidebar").close();
  Alpine.store("graphFullScreen").close();
});

// Command palette shortcuts
Mousetrap.bind("command+k", function(e) {
  e.preventDefault();
  
  // Find the command palette element
  const cmdPalette = document.querySelector('.cmd-palette');
  if (cmdPalette && typeof cmdPalette.__x !== 'undefined') {
    // Call the openPalette method on the Alpine.js component
    cmdPalette.__x.openPalette();
  }
});

// Add vim-like navigation shortcuts
Mousetrap.bind("ctrl+j", function(e) {
  if (document.querySelector('.cmd-overlay.cmd-modal-active')) {
    e.preventDefault();
    const cmdPalette = document.querySelector('.cmd-palette');
    if (cmdPalette && typeof cmdPalette.__x !== 'undefined') {
      cmdPalette.__x.next();
    }
  }
});

Mousetrap.bind("ctrl+k", function(e) {
  if (document.querySelector('.cmd-overlay.cmd-modal-active')) {
    e.preventDefault();
    const cmdPalette = document.querySelector('.cmd-palette');
    if (cmdPalette && typeof cmdPalette.__x !== 'undefined') {
      cmdPalette.__x.prev();
    }
  }
});
