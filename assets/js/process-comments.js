const nodeIterator = document.createNodeIterator(
  document.body,
  NodeFilter.SHOW_COMMENT
);

const pairs = new Map();

while(nodeIterator.nextNode()) {
  const commentNode = nodeIterator.referenceNode;
  const name = commentNode.data.trim();
  const splitName = name.split("/")[1];
  let pairValue = pairs.get(name);

  if (splitName) {
    pairValue = pairs.get(splitName);
    pairs.set(splitName, [...pairValue, commentNode]);
  }
  else {
    if (!pairValue) {
      pairs.set(name, [commentNode]);
    }
    else {
      pairs.set(name, [...pairValue, commentNode]);
    }
  }
}

pairs.forEach(([start, end]) => {
  if (start.nodeType === Node.COMMENT_NODE) {
    const div = document.createElement("div");
    const className = start.data.trim().split(" ")[0];

    div.classList.add(className);
    start.parentNode.replaceChild(div, start);
    start = div;
  }
  if (end) {
    while (start.nextSibling != end) {
      start.appendChild(start.nextSibling);
    }
    end.parentElement.removeChild(end);
  }
})
