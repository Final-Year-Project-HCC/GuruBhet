import Image from "next/image";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border bg-muted/30 text-sm">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Image src="/GuruBhetSmall.png" alt="Company Logo" width={40} height={40} />
          <span className="text-muted-foreground">© {year} Gurubhet</span>
        </div>

        <nav className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-6">
          <a href="/refund-policy" className="text-foreground hover:underline">
            Refund Policy
          </a>
          <a href="mailto:support.gurubhet@gmail.com" className="text-foreground hover:underline">
            support.gurubhet@gmail.com
          </a>
          <div className="flex items-center gap-4">
            <a
              href="https://twitter.com/"
              target="_blank"
              rel="noreferrer"
              aria-label="Twitter"
              className="text-muted-foreground hover:text-foreground"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path d="M22 5.8c-.7.3-1.5.5-2.2.6.8-.5 1.4-1.2 1.7-2.1-.8.5-1.7.8-2.6 1A3.7 3.7 0 0 0 12 7.9c0 .3 0 .5.1.8-3.1-.2-5.9-1.6-7.8-3.9-.3.5-.4 1.1-.4 1.7 0 1.3.7 2.5 1.8 3.1-.6 0-1.2-.2-1.7-.5v.1c0 1.8 1.3 3.3 3 3.7-.3.1-.6.1-.9.1-.2 0-.4 0-.6-.1.4 1.5 1.9 2.6 3.6 2.7A7.5 7.5 0 0 1 2 19a10.5 10.5 0 0 0 5.7 1.7c6.8 0 10.6-5.6 10.6-10.6v-.5c.7-.5 1.3-1.2 1.7-1.9Z" />
              </svg>
            </a>
            <a
              href="https://facebook.com/"
              target="_blank"
              rel="noreferrer"
              aria-label="Facebook"
              className="text-muted-foreground hover:text-foreground"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path d="M22 12a10 10 0 1 0-11.6 9.9v-7h-2.4V12h2.4V9.7c0-2.4 1.4-3.7 3.6-3.7 1 0 2 .2 2 .2v2.3h-1.1c-1.1 0-1.5.7-1.5 1.4V12h2.6l-.4 2.9h-2.2v7A10 10 0 0 0 22 12Z" />
              </svg>
            </a>
            <a
              href="https://instagram.com/"
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram"
              className="text-muted-foreground hover:text-foreground"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7Zm5 3.5A5.5 5.5 0 1 1 6.5 13 5.5 5.5 0 0 1 12 7.5Zm0 2A3.5 3.5 0 1 0 15.5 13 3.5 3.5 0 0 0 12 9.5Zm5.75-2.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
              </svg>
            </a>
            <a
              href="https://linkedin.com/"
              target="_blank"
              rel="noreferrer"
              aria-label="LinkedIn"
              className="text-muted-foreground hover:text-foreground"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path d="M20.45 20.45h-3.55v-5.6c0-1.34-.02-3.06-1.86-3.06-1.86 0-2.15 1.45-2.15 2.95v5.71H9.34V9h3.41v1.56h.05c.48-.91 1.64-1.86 3.37-1.86 3.6 0 4.27 2.37 4.27 5.44v6.31ZM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14Zm-1.78 13.02h3.56V9H3.56v11.45Z" />
              </svg>
            </a>
          </div>
        </nav>
      </div>
    </footer>
  );
}
