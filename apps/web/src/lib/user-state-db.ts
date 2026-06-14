import Dexie, { type Table } from "dexie";

export type SavedArticle = {
  articleId: string;
  savedAt: string;
};

export type ReadArticle = {
  articleId: string;
  readAt: string;
};

export type ReadingProgress = {
  feedType: string;
  articleId: string;
  updatedAt: string;
};

export type AppSettingKey = "theme";

export type AppSetting = {
  key: AppSettingKey;
  value: string;
};

export class UptoUserStateDatabase extends Dexie {
  appSettings: Table<AppSetting, AppSettingKey>;
  readArticles: Table<ReadArticle, string>;
  readingProgress: Table<ReadingProgress, string>;
  savedArticles: Table<SavedArticle, string>;

  constructor(databaseName = "upto_user_state") {
    super(databaseName);
    this.version(1).stores({
      app_settings: "key",
      read_articles: "articleId, readAt",
      reading_progress: "feedType, articleId, updatedAt",
      saved_articles: "articleId, savedAt",
    });

    this.appSettings = this.table("app_settings");
    this.readArticles = this.table("read_articles");
    this.readingProgress = this.table("reading_progress");
    this.savedArticles = this.table("saved_articles");
  }
}

let userStateDb: UptoUserStateDatabase | null = null;

export function getUserStateDb(): UptoUserStateDatabase | null {
  if (typeof indexedDB === "undefined") {
    return null;
  }

  userStateDb ??= new UptoUserStateDatabase();
  return userStateDb;
}

export async function markArticleSaved(
  articleId: string,
  isSaved: boolean,
  now = new Date(),
  db = getUserStateDb(),
): Promise<void> {
  if (!db) {
    return;
  }

  if (!isSaved) {
    await db.savedArticles.delete(articleId);
    return;
  }

  await db.savedArticles.put({
    articleId,
    savedAt: now.toISOString(),
  });
}

export async function markArticleRead(
  articleId: string,
  now = new Date(),
  db = getUserStateDb(),
): Promise<void> {
  if (!db) {
    return;
  }

  await db.readArticles.put({
    articleId,
    readAt: now.toISOString(),
  });
}

export async function saveReadingProgress(
  feedType: string,
  articleId: string,
  now = new Date(),
  db = getUserStateDb(),
): Promise<void> {
  if (!db) {
    return;
  }

  await db.readingProgress.put({
    articleId,
    feedType,
    updatedAt: now.toISOString(),
  });
}

export async function getReadingProgress(
  feedType: string,
  db = getUserStateDb(),
): Promise<ReadingProgress | undefined> {
  if (!db) {
    return undefined;
  }

  return db.readingProgress.get(feedType);
}

export async function setAppSetting(
  key: AppSettingKey,
  value: string,
  db = getUserStateDb(),
): Promise<void> {
  if (!db) {
    return;
  }

  await db.appSettings.put({ key, value });
}

export async function getAppSetting(
  key: AppSettingKey,
  db = getUserStateDb(),
): Promise<AppSetting | undefined> {
  if (!db) {
    return undefined;
  }

  return db.appSettings.get(key);
}
