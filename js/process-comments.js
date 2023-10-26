const nodeIterator = document.createNodeIterator(
  document.body,
  NodeFilter.SHOW_COMMENT
);

const pairs = [];
const buffer = [];
while(nodeIterator.nextNode()) {
  const commentNode = nodeIterator.referenceNode;
  buffer.push(commentNode);

  if (commentNode.data.trim().startsWith("end")) {
    pairs.push([...buffer]);
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
})
