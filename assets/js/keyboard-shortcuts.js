Mousetrap.bind("command+shift+f", function() {
  Alpine.store("readingMode").toggle();
});

Mousetrap.bind("escape", function() {
  Alpine.store("sidebar").close();
  Alpine.store("graphFullScreen").close();
});
