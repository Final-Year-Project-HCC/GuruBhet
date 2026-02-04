import Link from "next/link";
import Image from "next/image";

export default function PublicNavbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <Link href="/">
            <Image src="/GuruBhet.png" alt="Logo" width={150} height={37} className="dark:invert" />
          </Link>
        </div>

        <nav className="flex items-center gap-3">
          <Link
            href="/search-teacher"
            className="rounded-md px-3 py-2 text-base text-foreground hover:bg-muted"
          >
            Search Teacher
          </Link>
          <Link
            href="#"
            className="rounded-md px-3 py-2 text-base text-foreground hover:bg-muted"
          >
            Become a Teacher
          </Link>
          <Link
            href="/login"
            className="rounded-md px-3 py-2 text-base text-foreground hover:bg-muted"
          >
            Login
          </Link>
          <Link
            href="/signup"
            className="rounded-md bg-primary px-3 py-2 text-base text-primary-foreground hover:opacity-90"
          >
            Sign up
          </Link>
        </nav>
      </div>
    </header>
  );
}
