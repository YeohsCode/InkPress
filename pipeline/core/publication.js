const PUBLICATION_TITLE = "Yeoh's AI Daily News";

function mastheadTitle(kicker = '') {
  const issue = String(kicker).replace(/^(?:Yeoh's AI Daily News|Daily AI News|AI Daily News|AI\s*日报)\s*(?:[·｜|]\s*)?/i, '').trim();
  return issue ? `${PUBLICATION_TITLE} · ${issue}` : PUBLICATION_TITLE;
}

module.exports = { PUBLICATION_TITLE, mastheadTitle };
