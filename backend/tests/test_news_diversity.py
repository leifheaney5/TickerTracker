from services.news import diversify_news


def article(source, headline, url):
    return {"source": source, "headline": headline, "url": url, "datetime": "1h ago"}


def test_diversify_news_deduplicates_and_caps_each_source():
    items = [
        article("Reuters", "A", "https://r.test/a"),
        article("Reuters", "B", "https://r.test/b"),
        article("Reuters", "C", "https://r.test/c"),
        article("CNBC", "D", "https://c.test/d"),
        article("Bloomberg", "E", "https://b.test/e"),
        article("CNBC", "a", "https://c.test/duplicate-headline"),
        article("AP", "F", "https://r.test/a"),
    ]
    result = diversify_news(items, limit=12, per_source=2)
    assert [row["source"] for row in result] == ["Reuters", "CNBC", "Bloomberg", "Reuters"]
    assert [row["headline"] for row in result] == ["A", "D", "E", "B"]


def test_diversify_news_returns_honest_low_diversity_output():
    items = [article("Reuters", str(i), f"https://r.test/{i}") for i in range(5)]
    assert len(diversify_news(items, per_source=2)) == 2
