const button = document.querySelector(".btn-reading-mode-toggler");
const tooltip = document.querySelector(".btn-reading-mode-toggler-tooltip");
const popperInstance = Popper.createPopper(button, tooltip, {
  modifiers: [
    {
      name: "offset",
      options: {
        offset: [0, 8],
      },
    },
  ],
});

function show() {
  // Make the tooltip visible
  tooltip.setAttribute("data-show", "");

  // Enable the event listeners
  popperInstance.setOptions((options) => ({
    ...options,
    modifiers: [
      ...options.modifiers,
      { name: "eventListeners", enabled: true },
    ],
  }));

  // Update its position
  popperInstance.update();
}

function hide() {
  // Hide the tooltip
  tooltip.removeAttribute("data-show");

  // Disable the event listeners
  popperInstance.setOptions((options) => ({
    ...options,
    modifiers: [
      ...options.modifiers,
      { name: "eventListeners", enabled: false },
    ],
  }));
}

const showEvents = ["mouseenter", "focus"];
const hideEvents = ["mouseleave", "blur"];

showEvents.forEach((event) => {
  button?.addEventListener(event, show);
});

hideEvents.forEach((event) => {
  button?.addEventListener(event, hide);
});
