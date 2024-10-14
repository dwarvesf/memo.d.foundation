const MARKDOWN_BOLD_PATTERN = /^\*\*.*\*\*$/;
const MARKDOWN_BLOCKQUOTE_PATTERN = /(&gt;)+(.*)/;
const MARKDOWN_LINK_PATTERN = /\[(.*)\]\((.*)\)/g;

const boldPatternSelectors = ['span', 'a'];

boldPatternSelectors.forEach(selector => {
    Array.from(document.querySelectorAll(selector) || []).forEach(element => {
        if (!element.closest('pre') && MARKDOWN_BOLD_PATTERN.test(element.innerHTML.trim())) {
            const codeWithBold = element.innerHTML.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
            element.innerHTML = codeWithBold;
        }
    })
})

const blockquotePatternSelectors = ['p'];

blockquotePatternSelectors.forEach(selector => {
    Array.from(document.querySelectorAll(selector) || []).forEach(element => {
        if (!element.closest('pre') && MARKDOWN_BLOCKQUOTE_PATTERN.test(element.innerHTML.trim())) {
            const quotes = element.innerHTML.split(/^&gt;(?<=(&gt;|[A-Za-z]))/gm);
            const quotesFlatNewline = quotes.flatMap(quote => quote.split('\n').filter(el => el));
            const flatQuotes = quotesFlatNewline.map(quote =>
                quote.replace(/^(&gt;)+(.+)/gm, '$2')
            );

            let depth = 0;
            let unnest = false;
            const codeWithBlockquotes = flatQuotes.reduce((acc, curr) => {
                if (curr === '&gt;') {
                    acc += '<blockquote>'
                    depth += 1;
                    unnest = false;
                    return acc;
                }
                if (unnest) {
                    [...Array(depth)].forEach(() => {
                        acc += '</blockquote>'
                    });
                }
                acc += `<p>${curr}</p>`
                unnest = true;
                return acc;
            }, '')

            element.innerHTML = codeWithBlockquotes;
        }
    })
})

const markdownLinkPatternSelectors = ['span', 'b', 'main'];

markdownLinkPatternSelectors.forEach(selector => {
    Array.from(document.querySelectorAll(selector) || []).forEach(element => {
        if (!element.closest('pre') && MARKDOWN_LINK_PATTERN.test(element.innerHTML.trim())) {
            const link = element.innerHTML.replace(MARKDOWN_LINK_PATTERN, '<a href="$2">$1</a>');
            element.innerHTML = link;
        }
    })
})

const wrappedElements = document.querySelectorAll('table, ul, ol');

wrappedElements.forEach((table) => {
    const wrapper = document.createElement('div');
    wrapper.classList.add('scrollable');
    table.parentNode.insertBefore(wrapper, table);
    wrapper.appendChild(table);
});
