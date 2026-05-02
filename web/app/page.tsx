import { Generator } from "./generator";

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">
            sandybeach
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            chroma t2i &amp; i2i, served on runpod
          </p>
        </header>
        <Generator />
      </div>
    </main>
  );
}
