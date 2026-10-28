/* Runs in the browser. Check visible text fragments, not just container sizes. */
function auditCopy({ checkImages = true } = {}) {
  const issues = [];
  const footerTop = document.querySelector('.footer').getBoundingClientRect().top;
  // Protected figures never allow text overlays, including in magazine mode.
  const images = [...document.querySelectorAll(checkImages ? 'img,[data-evidence-visual]' : '[data-evidence-visual]')]
    .map(node => ({ node, rect: node.getBoundingClientRect() })).filter(({ rect }) => rect.width && rect.height);
  const intersects = (a, b) => a.left < b.right - 1 && a.right > b.left + 1 &&
    a.top < b.bottom - 1 && a.bottom > b.top + 1;
  const selector = '.masthead,.kicker,.caption,.title,.lede,.body,.numberbody,[data-evidence-visual]';
  const roots = [...document.querySelectorAll(selector)]
    .filter(node => !node.parentElement.closest(selector));
  for (const root of roots) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (!node.textContent.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        let reason;
        if (rect.left < -1 || rect.right > 1243 || rect.top < -1 || rect.bottom > footerTop - 8) {
          reason = 'outside copy area';
        }
        for (let parent = node.parentElement; !reason && parent; parent = parent.parentElement) {
          const style = getComputedStyle(parent);
          const box = parent.getBoundingClientRect();
          const clipsX = /hidden|clip|auto|scroll/.test(style.overflowX);
          const clipsY = /hidden|clip|auto|scroll/.test(style.overflowY);
          if ((clipsX && (rect.left < box.left - 1 || rect.right > box.right + 1)) ||
              (clipsY && (rect.top < box.top - 1 || rect.bottom > box.bottom + 1))) {
            reason = 'clipped by container';
          }
        }
        if (!reason && images.some(image => !image.node.contains(node) && intersects(rect, image.rect))) reason = 'overlaps image';
        if (reason) issues.push({ reason, text: node.textContent.slice(0, 50) });
      }
    }
  }
  return issues;
}

module.exports = { auditCopy };
