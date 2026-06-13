"use client";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen px-4">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center">
        <p className="text-sm font-medium text-[var(--accent)]">Upto</p>
        <h1 className="mt-3 text-3xl leading-tight font-semibold">記事を読み込めませんでした</h1>
        <p className="mt-5 max-w-xl leading-7 text-[var(--muted)]">
          DB接続または記事取得中にエラーが発生しました。環境変数 `DATABASE_URL`
          とデータベースの状態を確認してください。
        </p>
        <p className="mt-3 text-sm text-[var(--muted)]">{error.message}</p>
        <button
          className="mt-7 w-fit rounded-md bg-[var(--foreground)] px-4 py-2.5 text-sm font-medium text-white"
          onClick={reset}
          type="button"
        >
          再読み込み
        </button>
      </div>
    </main>
  );
}
