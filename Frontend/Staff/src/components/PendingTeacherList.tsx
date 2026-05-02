"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { MdChevronRight } from "react-icons/md";

type PendingTeacherItem = {
  userId: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  avatarUrl?: string;
  createdAt: string;
};

function AvatarDisplay({ firstName, avatarUrl }: { firstName: string; avatarUrl?: string }) {
  const initials = firstName.charAt(0).toUpperCase();
  const bgColor = `hsl(${firstName.charCodeAt(0) * 15 % 360}, 70%, 60%)`;

  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt="Teacher avatar"
        width={48}
        height={48}
        className="h-12 w-12 rounded-full object-cover border border-border shrink-0"
      />
    );
  }

  return (
    <div
      style={{ backgroundColor: bgColor }}
      className="h-12 w-12 rounded-full flex items-center justify-center text-white font-semibold border border-border shrink-0"
    >
      {initials}
    </div>
  );
}

export default function PendingTeacherList({ items, routePrefix = "/teachers" }: { items: PendingTeacherItem[]; routePrefix?: string }) {
  const router = useRouter();

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No pending submissions</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((t) => {
        const fullName = [t.firstName, t.middleName, t.lastName].filter(Boolean).join(" ");
        const submittedDate = t.createdAt ? new Date(t.createdAt) : null;

        return (
          <div
            key={t.userId}
            className="flex items-center gap-4 rounded-lg border border-border bg-card px-5 py-4 shadow-sm hover:shadow-md hover:bg-accent/40 transition-all cursor-pointer"
            onClick={() => router.push(`${routePrefix}/${t.userId}`)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") router.push(`${routePrefix}/${t.userId}`);
            }}
            aria-label={`Open details for ${fullName}`}
          >
            <AvatarDisplay firstName={t.firstName} avatarUrl={t.avatarUrl} />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground">{fullName}</h3>
              <p className="text-sm text-muted-foreground truncate">{t.email}</p>
            </div>
            {submittedDate && (
              <p className="hidden sm:block text-xs text-muted-foreground shrink-0">
                Submitted {submittedDate.toLocaleDateString()} at{" "}
                {submittedDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
            <MdChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
          </div>
        );
      })}
    </div>
  );
}
