"""Simon Willison blog (simonwillison.net) source — AI/LLM practitioner signal."""
from pipeline.sources.rssbase import main  # noqa: E402

SOURCE = "simonw"
FEED_URL = "https://simonwillison.net/atom/everything/"

if __name__ == "__main__":
    main(SOURCE, FEED_URL)
