const nodeIterator = document.createNodeIterator(
  document.body,
  NodeFilter.SHOW_COMMENT
);

const pairs = [];
const buffer = [];

while(nodeIterator.nextNode()) {
  const commentNode = nodeIterator.referenceNode;
  const name = commentNode.data.trim();
  buffer.push(commentNode);

  if (buffer.length > 1) {
    const prevName = buffer[0].data.trim();
    if (name.includes(prevName)) {
      pairs.push([...buffer]);
    }
    buffer.length = 0;
  }
}

pairs.forEach(([start, end]) => {
  if (start.nodeType === Node.COMMENT_NODE) {
    const div = document.createElement("div");
    div.classList.add(start.data.trim());
    start.parentNode.replaceChild(div, start);
    start = div;
  }
  while (start.nextSibling != end) {
    start.appendChild(start.nextSibling);
  }
  end.parentElement.removeChild(end);
})
