import { connection } from "next/server";

import { ArticleFeed } from "../components/article-feed";
import { getArticlesPage } from "../lib/articles";

export default async function HomePage() {
  await connection();
  const articlePage = await getArticlesPage({ limit: 10 });

  return (
    <main>
      <ArticleFeed
        articles={articlePage.articles}
        initialCursor={articlePage.nextCursor}
        initialHasMore={articlePage.hasMore}
        initialSnapshotAt={articlePage.snapshotAt}
      />
    </main>
  );
}
