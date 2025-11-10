export function chunkHtmlContent(
  htmlContent: string,
  maxLength: number,
): { htmlChunks: string[]; textChunks: string[] } {
  const parser: DOMParser = new DOMParser();
  const doc: Document = parser.parseFromString(htmlContent, "text/html");
  const htmlChunks: string[] = [];
  const textChunks: string[] = [];
  let currentHtmlChunk: string = "";
  let currentTextChunk: string = "";
  let openTags: string[] = [];

  function getOpeningTag(node: Element): string {
    const tagName: string = node.tagName.toLowerCase();
    const attributes: string = Array.from(node.attributes)
      .map((attr: Attr) => `${attr.name}="${attr.value}"`)
      .join(" ");
    return `<${tagName}${attributes ? " " + attributes : ""}>`;
  }

  function closeOpenTags(): string {
    let closingTags: string = "";
    for (let i: number = openTags.length - 1; i >= 0; i--) {
      closingTags += `</${openTags[i]}>`;
    }
    return closingTags;
  }

  function openClosedTags(): string {
    return openTags.map((tag: string) => `<${tag}>`).join("");
  }

  function addHtmlChunk(content: string, isTextNode: boolean): void {
    if (currentHtmlChunk.length + content.length > maxLength && currentHtmlChunk.length > 0) {
      htmlChunks.push(currentHtmlChunk + closeOpenTags());
      textChunks.push(currentTextChunk);
      currentHtmlChunk = openClosedTags();
      currentTextChunk = "";
      openTags = [];
    }
    currentHtmlChunk += content;
    if (isTextNode) {
      currentTextChunk += content;
    }
  }

  function traverse(node: Node): void {
    if (node.nodeType === Node.ELEMENT_NODE) {
      openTags.push(node.nodeName.toLowerCase());
      addHtmlChunk(getOpeningTag(node as Element), false);
      Array.from(node.childNodes).forEach((childNode: Node) => traverse(childNode));
      openTags.pop();
      addHtmlChunk(`</${node.nodeName.toLowerCase()}>`, false);
    } else if (node.nodeType === Node.TEXT_NODE) {
      addHtmlChunk(node.textContent || "", true);
    }
  }

  traverse(doc.body);

  return { htmlChunks, textChunks };
}
