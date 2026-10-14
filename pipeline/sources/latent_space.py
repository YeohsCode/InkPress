"""Latent Space: AI engineering news and podcast episodes from the official RSS."""
from pipeline.sources.rssbase import main

SOURCE = "latent_space"
FEED_URL = "https://www.latent.space/feed"

if __name__ == "__main__":
    main(SOURCE, FEED_URL)
