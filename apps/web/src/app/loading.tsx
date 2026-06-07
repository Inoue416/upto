export default function Loading() {
  return (
    <main className="min-h-screen px-4">
      <header className="fixed top-0 right-0 left-0 z-10 border-b border-[var(--border)] bg-[var(--background)]/92 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div>
            <h1 className="text-lg leading-none font-semibold">Upto</h1>
            <p className="mt-1 text-xs text-[var(--muted)]">日本語ITニュース要約</p>
          </div>
          <span className="rounded-full bg-[var(--surface)] px-3 py-1 text-sm text-[var(--muted)] shadow-sm">
            loading
          </span>
        </div>
      </header>
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center pt-16">
        <div className="h-6 w-28 animate-pulse rounded-full bg-[var(--accent-soft)]" />
        <div className="mt-5 h-10 w-11/12 animate-pulse rounded-lg bg-[var(--surface)]" />
        <div className="mt-3 h-10 w-8/12 animate-pulse rounded-lg bg-[var(--surface)]" />
        <div className="mt-8 space-y-3">
          <div className="h-16 animate-pulse rounded-lg bg-[var(--surface)]" />
          <div className="h-16 animate-pulse rounded-lg bg-[var(--surface)]" />
          <div className="h-16 animate-pulse rounded-lg bg-[var(--surface)]" />
        </div>
      </div>
    </main>
  );
}
