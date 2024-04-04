const copyIcon =
  '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 256 256"><path fill="#9b9b9b" d="M216 32H88a8 8 0 0 0-8 8v40H40a8 8 0 0 0-8 8v128a8 8 0 0 0 8 8h128a8 8 0 0 0 8-8v-40h40a8 8 0 0 0 8-8V40a8 8 0 0 0-8-8m-56 176H48V96h112Zm48-48h-32V88a8 8 0 0 0-8-8H96V48h112Z"/></svg>';
const checkIcon =
  '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="none" stroke="#3dc740" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M20 7L10 17l-5-5"/></svg>';

function init() {
  if (!navigator.clipboard) return;
  const codeblocks = document.querySelectorAll("main pre");

  for (const cb of codeblocks) {
    const copyBtn = document.createElement("button");
    copyBtn.className = "copy-btn";
    copyBtn.innerHTML = copyIcon;
    let timeout;
    copyBtn.onclick = function () {
      window.clearTimeout(timeout);
      copyBtn.innerHTML = checkIcon;
      const code = cb.querySelector("code");
      navigator.clipboard.writeText(code.textContent);
      timeout = window.setTimeout(() => (copyBtn.innerHTML = copyIcon), 1000);
    };
    cb.appendChild(copyBtn);
  }
}

init();
