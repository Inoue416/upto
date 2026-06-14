import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";

import {
  getAppSetting,
  getReadingProgress,
  markArticleRead,
  markArticleSaved,
  saveReadingProgress,
  setAppSetting,
  UptoUserStateDatabase,
} from "./user-state-db";

describe("UptoUserStateDatabase", () => {
  const dbs: UptoUserStateDatabase[] = [];

  afterEach(async () => {
    await Promise.all(
      dbs.splice(0).map(async (db) => {
        db.close();
        await db.delete();
      }),
    );
  });

  function createTestDb() {
    const dbName = `upto_user_state_test_${crypto.randomUUID()}`;
    const db = new UptoUserStateDatabase(dbName);
    dbs.push(db);
    return db;
  }

  it("stores saved articles, read articles, reading progress, and UI settings", async () => {
    const db = createTestDb();
    const savedAt = new Date("2026-06-15T00:00:00.000Z");
    const readAt = new Date("2026-06-15T00:00:03.000Z");
    const progressAt = new Date("2026-06-15T00:00:04.000Z");

    await markArticleSaved("article-1", true, savedAt, db);
    await markArticleRead("article-1", readAt, db);
    await saveReadingProgress("home", "article-1", progressAt, db);
    await setAppSetting("theme", "dark", db);

    await expect(db.savedArticles.get("article-1")).resolves.toEqual({
      articleId: "article-1",
      savedAt: "2026-06-15T00:00:00.000Z",
    });
    await expect(db.readArticles.get("article-1")).resolves.toEqual({
      articleId: "article-1",
      readAt: "2026-06-15T00:00:03.000Z",
    });
    await expect(getReadingProgress("home", db)).resolves.toEqual({
      articleId: "article-1",
      feedType: "home",
      updatedAt: "2026-06-15T00:00:04.000Z",
    });
    await expect(getAppSetting("theme", db)).resolves.toEqual({
      key: "theme",
      value: "dark",
    });

    db.close();
  });

  it("removes saved articles without deleting read state", async () => {
    const db = createTestDb();

    await markArticleSaved("article-1", true, new Date("2026-06-15T00:00:00.000Z"), db);
    await markArticleRead("article-1", new Date("2026-06-15T00:00:03.000Z"), db);
    await markArticleSaved("article-1", false, new Date("2026-06-15T00:00:05.000Z"), db);

    await expect(db.savedArticles.get("article-1")).resolves.toBeUndefined();
    await expect(db.readArticles.get("article-1")).resolves.toMatchObject({
      articleId: "article-1",
    });

    db.close();
  });
});
