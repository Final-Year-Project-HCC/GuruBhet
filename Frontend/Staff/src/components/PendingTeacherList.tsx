"use client";

import { useRouter } from "next/navigation";
type PendingTeacherItem = {
  id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  submittedAt?: string;
};

export default function PendingTeacherList({ items, routePrefix = "/teachers" }: { items: PendingTeacherItem[]; routePrefix?: string }) {
  const router = useRouter();

  return (
    <div className="overflow-hidden rounded-md border border-border">
      <table className="w-full text-left">
        <thead className="bg-primary text-primary-foreground">
          <tr>
            <th className="px-4 py-2">Name</th>
            <th className="px-4 py-2">Email</th>
            <th className="px-4 py-2">Submitted</th>
          </tr>
        </thead>
        <tbody>
          {items.map((t, idx) => {
            const fullName = [t.firstName, t.middleName, t.lastName].filter(Boolean).join(" ");
            const rowBg = idx % 2 === 0 ? "bg-background" : "bg-muted";
            return (
              <tr
                key={t.id}
                className={`${rowBg} border-t border-border cursor-pointer hover:opacity-90`}
                onClick={() => router.push(`${routePrefix}/${t.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") router.push(`${routePrefix}/${t.id}`);
                }}
                aria-label={`Open details for ${fullName}`}
              >
                <td className="px-4 py-2">{fullName}</td>
                <td className="px-4 py-2">{t.email}</td>
                <td className="px-4 py-2 text-sm text-muted-foreground">{t.submittedAt ? new Date(t.submittedAt).toLocaleString() : "—"}</td>
              </tr>
            );
          })}
          {items.length === 0 && (
            <tr>
              <td className="px-4 py-6 text-center text-muted-foreground" colSpan={3}>No pending submissions</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
