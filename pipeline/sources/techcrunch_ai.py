"""TechCrunch AI category RSS source."""
from pipeline.sources.rssbase import main  # noqa: E402

SOURCE = "techcrunch_ai"
FEED_URL = "https://techcrunch.com/category/artificial-intelligence/feed/"

if __name__ == "__main__":
    main(SOURCE, FEED_URL)
