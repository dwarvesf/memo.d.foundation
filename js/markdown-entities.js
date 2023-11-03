const MARKDOWN_BOLD_PATTERN = /^\*\*.*\*\*$/;

const selectors = ['code', 'span', 'a'];

selectors.forEach(selector => {
    Array.from(document.querySelectorAll(selector) || []).forEach(element => {
        if (MARKDOWN_BOLD_PATTERN.test(element.innerHTML.trim())) {
            const codeWithBold = element.innerHTML.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');

            element.innerHTML = codeWithBold;
        }
    })
})
