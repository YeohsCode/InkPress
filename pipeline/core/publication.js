const PUBLICATION_TITLE = "Yeoh's AI Daily News";

function publicationTitle(report = {}) {
  const weekly = report.edition === 'weekly' || /\bweekly\b|周报|周刊/i.test(report.series || '');
  return weekly ? "Yeoh's AI Weekly News" : PUBLICATION_TITLE;
}

function mastheadTitle(kicker = '') {
  const issue = String(kicker).replace(/^(?:Yeoh's AI Daily News|Daily AI News|AI Daily News|AI\s*日报)\s*(?:[·｜|]\s*)?/i, '').trim();
  return issue ? `${PUBLICATION_TITLE} · ${issue}` : PUBLICATION_TITLE;
}

function issueDateLabel(date) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error('Invalid issue date');
  return `${Number(match[2])}月${Number(match[3])}日`;
}

module.exports = { PUBLICATION_TITLE, publicationTitle, mastheadTitle, issueDateLabel };
