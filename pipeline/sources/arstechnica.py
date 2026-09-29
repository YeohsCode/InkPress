"""Ars Technica technology RSS source (AI-filtered)."""
from pipeline.sources.rssbase import main  # noqa: E402

SOURCE = "arstechnica"
FEED_URL = "https://feeds.arstechnica.com/arstechnica/technology-lab"
KEYWORDS = ["ai", "artificial intelligence", "llm", "openai", "anthropic",
            "google", "gpt", "claude", "gemini", "model", "agent", "robot"]

if __name__ == "__main__":
    main(SOURCE, FEED_URL, keywords=KEYWORDS)
