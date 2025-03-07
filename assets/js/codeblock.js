const copyIcon =
  '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6.0385 11.6667C5.70172 11.6667 5.41667 11.5501 5.18333 11.3167C4.95 11.0834 4.83333 10.7984 4.83333 10.4616V2.87191C4.83333 2.53514 4.95 2.25008 5.18333 2.01675C5.41667 1.78341 5.70172 1.66675 6.0385 1.66675H11.6282C11.9649 1.66675 12.25 1.78341 12.4833 2.01675C12.7167 2.25008 12.8333 2.53514 12.8333 2.87191V10.4616C12.8333 10.7984 12.7167 11.0834 12.4833 11.3167C12.25 11.5501 11.9649 11.6667 11.6282 11.6667H6.0385ZM6.0385 10.6667H11.6282C11.6795 10.6667 11.7265 10.6454 11.7692 10.6026C11.8119 10.5599 11.8333 10.5129 11.8333 10.4616V2.87191C11.8333 2.82058 11.8119 2.77358 11.7692 2.73091C11.7265 2.68814 11.6795 2.66675 11.6282 2.66675H6.0385C5.98717 2.66675 5.94017 2.68814 5.8975 2.73091C5.85472 2.77358 5.83333 2.82058 5.83333 2.87191V10.4616C5.83333 10.5129 5.85472 10.5599 5.8975 10.6026C5.94017 10.6454 5.98717 10.6667 6.0385 10.6667ZM3.70517 14.0001C3.36839 14.0001 3.08333 13.8834 2.85 13.6501C2.61667 13.4167 2.5 13.1317 2.5 12.7949V4.20525H3.5V12.7949C3.5 12.8462 3.52139 12.8932 3.56417 12.9359C3.60683 12.9787 3.65383 13.0001 3.70517 13.0001H10.2948V14.0001H3.70517Z" fill="#9B9B9B"/></svg>';

if (typeof Prism !== 'undefined') {
  Prism.hooks.add('complete', function(env) {
    if (!navigator.clipboard) return;

    const pre = env.element.parentElement;
    if (!pre || !/pre/i.test(pre.nodeName)) return;

    // Set the language attribute
    const language = env.language || 'text';
    pre.setAttribute('data-language', language);

    // Check if header already exists
    if (pre.querySelector('.code-block-header')) return;

    // Create header container
    const header = document.createElement('div');
    header.className = 'code-block-header';

    // Create copy button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'code-copy-btn';
    copyBtn.innerHTML = `${copyIcon} Copy`;

    copyBtn.onclick = function() {
      navigator.clipboard.writeText(env.element.textContent);
      Toastify({
        text: 'Copied to clipboard!',
        duration: 1000,
        newWindow: true,
        close: true,
        gravity: 'top',
        position: 'center',
        stopOnFocus: true,
      }).showToast();
    };

    // Add buttons to header
    const langSpan = document.createElement('span');
    langSpan.className = 'code-language';
    langSpan.textContent = language;
    header.appendChild(langSpan);
    header.appendChild(copyBtn);
    pre.insertBefore(header, pre.firstChild);
  });
}
