"use client";
import Link from "next/link";

// You will need to implement a useAuth hook or grab the permissions from context/cookies
import { useAuth } from "@/hooks/useAuth"; // Placeholder

type Permission = "staff:manage" | "teacher:verify" | "academic_domains:manage";

interface SidebarItem {
  label: string;
  href: string;
  requiredPermission: Permission;
}

const MENU_ITEMS: SidebarItem[] = [
  {
    label: "Staff Users",
    href: "/management",
    requiredPermission: "staff:manage",
  },
  {
    label: "Pending Teachers",
    href: "/approvals",
    requiredPermission: "teacher:verify",
  },
  {
    label: "Universities & Faculties",
    href: "/academics",
    requiredPermission: "academic_domains:manage",
  },
];

export default function PermissionSidebar() {
  const { user } = useAuth(); // Assume this returns { role, is_superuser, permissions: string[] }

  const hasAccess = (requiredPermission: Permission) => {
    if (user?.is_superuser) return true;
    return user?.permissions?.includes(requiredPermission);
  };

  return (
    <nav className="flex flex-col gap-4 p-4 border-r border-gray-200">
      {MENU_ITEMS.map(
        (item) =>
          hasAccess(item.requiredPermission) && (
            <Link
              key={item.href}
              href={item.href}
              className="hover:text-blue-600 transition-colors"
            >
              {item.label}
            </Link>
          ),
      )}
    </nav>
  );
}
