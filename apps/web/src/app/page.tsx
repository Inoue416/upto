import { connection } from "next/server";

import { ArticleFeed } from "../components/article-feed";
import { getInitialArticles } from "../lib/articles";

export default async function HomePage() {
  await connection();
  const articles = await getInitialArticles();

  return (
    <main>
      <ArticleFeed articles={articles} />
    </main>
  );
}
