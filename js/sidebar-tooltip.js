// Initialize tooltips for the sidebar items
document.addEventListener("DOMContentLoaded", function() {
  // Logo doesn't need a tooltip as it's just a home link

  // Initialize tooltips for each nav item
  const links = document.querySelectorAll('.sidebar-nav .sidebar-item');
  
  links.forEach((link, index) => {
    const tooltip = document.getElementById(`tooltip-${index}`);
    
    if (link && tooltip) {
      const popperInstance = Popper.createPopper(link, tooltip, {
        placement: 'right',
        modifiers: [
          {
            name: 'offset',
            options: {
              offset: [0, 12],
            },
          },
          {
            name: 'preventOverflow',
            options: {
              padding: 8,
            },
          }
        ],
      });

      // Show tooltip on hover
      ['mouseenter', 'focus'].forEach(event => {
        link.addEventListener(event, () => {
          tooltip.setAttribute('data-show', '');
          popperInstance.update();
        });
      });

      // Hide tooltip when mouse leaves
      ['mouseleave', 'blur'].forEach(event => {
        link.addEventListener(event, () => {
          tooltip.removeAttribute('data-show');
        });
      });
    }
  });
});