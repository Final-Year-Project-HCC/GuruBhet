import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <div className="space-y-8">
          {/* Main Heading */}
          <div className="space-y-4">
            <h1 className="text-4xl font-bold text-foreground">Staff Dashboard</h1>
            <p className="text-xl text-muted-foreground max-w-2xl">
              Manage teachers, create academic domain structures, and maintain system data.
            </p>
          </div>

          {/* Quick Actions Grid */}
          <div className="grid md:grid-cols-2 gap-6 pt-8">
            {/* Teachers Management */}
            <Link
              href="/teachers"
              className="group relative overflow-hidden rounded-lg border border-border bg-card p-6 hover:border-primary transition-all hover:shadow-lg hover:shadow-primary/10"
            >
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-xl">
                  👥
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">Teachers</h2>
                  <p className="text-muted-foreground">
                    Review and verify pending teacher submissions.
                  </p>
                </div>
              </div>
              <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>

            {/* Academic Setup */}
            <Link
              href="/academic-setup"
              className="group relative overflow-hidden rounded-lg border border-border bg-card p-6 hover:border-primary transition-all hover:shadow-lg hover:shadow-primary/10"
            >
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-xl">
                  🎓
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">Academic Setup</h2>
                  <p className="text-muted-foreground">
                    Create and manage universities, faculties, semesters, and subjects.
                  </p>
                </div>
              </div>
              <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
