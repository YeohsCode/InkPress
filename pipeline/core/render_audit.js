/* Runs in the browser. Check visible text fragments, not just container sizes. */
function auditCopy({ checkImages = true } = {}) {
  const issues = [];
  const footerTop = document.querySelector('.footer').getBoundingClientRect().top;
  // Protected figures never allow text overlays, including in magazine mode.
  const images = [...document.querySelectorAll(checkImages ? 'img,[data-evidence-visual]' : '[data-evidence-visual]')]
    .map(node => ({ node, rect: node.getBoundingClientRect() })).filter(({ rect }) => rect.width && rect.height);
  const intersects = (a, b) => a.left < b.right - 1 && a.right > b.left + 1 &&
    a.top < b.bottom - 1 && a.bottom > b.top + 1;
  const selector = '.masthead,.kicker,.caption,.title,.lede,.body,.numberbody,[data-evidence-visual],[data-audit-copy]';
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

// A successful image request is insufficient: the figure must actually be visible.
function auditFigures({ images = 0, visuals = 0 } = {}) {
  const issues = [];
  const inspect = (selector, expected) => {
    const nodes = [...document.querySelectorAll(selector)];
    if (nodes.length !== expected) issues.push(`${selector}: expected ${expected}, rendered ${nodes.length}`);
    for (const node of nodes) {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      const footerTop = document.querySelector('.footer').getBoundingClientRect().top;
      const backgroundArt = node.matches('img[data-art-background="true"]') && Boolean(node.closest('[data-editorial-art]'));
      if (rect.width < 1 || rect.height < 1 || style.visibility === 'hidden' || Number(style.opacity) === 0 ||
          rect.left < 0 || rect.right > 1243 || rect.top < 0 || rect.bottom > (backgroundArt ? 1657 : footerTop - 8)) {
        issues.push(`${selector}: hidden or outside figure area`);
      }
      if (node.tagName === 'IMG' && (!node.complete || !node.naturalWidth)) issues.push(`broken image: ${node.src}`);
      for (let parent = node.parentElement; parent; parent = parent.parentElement) {
        const box = parent.getBoundingClientRect();
        const css = getComputedStyle(parent);
        if (css.visibility === 'hidden' || Number(css.opacity) === 0 ||
            (/hidden|clip|auto|scroll/.test(css.overflowX) && (rect.left < box.left - 1 || rect.right > box.right + 1)) ||
            (/hidden|clip|auto|scroll/.test(css.overflowY) && (rect.top < box.top - 1 || rect.bottom > box.bottom + 1))) {
          issues.push(`${selector}: clipped or hidden by ancestor`);
          break;
        }
      }
    }
  };
  inspect('img', images);
  inspect('[data-evidence-visual]', visuals);
  return issues;
}

module.exports = { auditCopy, auditFigures };
