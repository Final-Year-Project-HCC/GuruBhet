import Image from "next/image";

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground p-8">
      <div className="mx-auto max-w-3xl space-y-10">

        {/* Header */}
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">
            Black & White Theme
          </h1>
          <p className="text-muted-foreground">
            React + Tailwind using CSS variables
          </p>
        </header>

        {/* Card */}
        <section className="rounded-lg border border-border bg-background p-6">
          <h2 className="text-xl font-semibold mb-2">
            Card Component
          </h2>
          <p className="text-muted-foreground mb-4">
            This card uses background, foreground, border, and muted colors.
          </p>

          <div className="flex gap-3">
            <button className="rounded-md bg-primary px-4 py-2 text-primary-foreground transition hover:opacity-90">
              Primary Action
            </button>

            <button className="rounded-md border border-border px-4 py-2 text-foreground transition hover:bg-muted">
              Secondary
            </button>
          </div>
        </section>

        {/* Form */}
        <section className="rounded-lg border border-border bg-background p-6 space-y-4">
          <h2 className="text-xl font-semibold">
            Form Elements
          </h2>

          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">
              Email
            </label>
            <input
              type="email"
              placeholder="you@example.com"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">
              Message
            </label>
            <textarea
              placeholder="Type something…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground"
            />
          </div>
        </section>

        {/* Muted surface */}
        <section className="rounded-lg bg-muted p-6">
          <p className="text-muted-foreground">
            Muted surfaces are great for secondary sections, sidebars, or footers.
          </p>
        </section>

        {/* Destructive */}
        <section className="rounded-lg border border-border bg-background p-6">
          <h2 className="text-xl font-semibold mb-2">
            Destructive Action
          </h2>
          <p className="text-muted-foreground mb-4">
            Still neutral, but clearly dangerous.
          </p>

          <button className="rounded-md bg-destructive px-4 py-2 text-destructive-foreground transition hover:opacity-90">
            Delete Account
          </button>
        </section>

        {/* Footer */}
        <footer className="border-t border-border pt-6 text-sm text-muted-foreground">
          © 2026 — Minimal React + Tailwind UI
        </footer>

      </div>
    </main>
  );
}
