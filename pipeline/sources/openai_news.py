"""OpenAI official news RSS source."""
from pipeline.sources.rssbase import main  # noqa: E402

SOURCE = "openai_news"
FEED_URL = "https://openai.com/news/rss.xml"

if __name__ == "__main__":
    main(SOURCE, FEED_URL)
