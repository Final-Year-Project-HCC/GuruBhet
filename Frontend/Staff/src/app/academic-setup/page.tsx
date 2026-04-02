"use client";

import { useState } from "react";
import UniversityManager from "@/components/Academics/UniversityManager";
import FacultyManager from "@/components/Academics/FacultyManager";
import SubjectManager from "@/components/Academics/SubjectManager";
import { FiGlobe, FiUsers, FiBookOpen } from "react-icons/fi";

type TabId = "universities" | "faculties" | "subjects";

const tabs: Array<{ id: TabId; label: string; icon: React.ReactNode; description: string }> = [
  {
    id: "universities",
    label: "Universities",
    icon: <FiGlobe size={20} />,
    description: "Create and manage universities",
  },
  {
    id: "faculties",
    label: "Faculties",
    icon: <FiUsers size={20} />,
    description: "Manage faculties within universities",
  },
  {
    id: "subjects",
    label: "Subjects",
    icon: <FiBookOpen size={20} />,
    description: "Create semesters and subjects",
  },
];

export default function AcademicDomainsAdmin() {
  const [activeTab, setActiveTab] = useState<TabId>("universities");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <h1 className="text-3xl font-bold text-foreground">Academic Domains</h1>
          <p className="text-muted-foreground mt-2">
            Manage the complete hierarchy of universities, faculties, semesters, and subjects for teacher bookings.
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-border bg-card sticky top-0 z-10">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex gap-1 overflow-x-auto py-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground border-b-2 border-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Show different content based on active tab */}
        {activeTab === "universities" && (
          <div className="animate-in fade-in duration-300">
            <UniversityManager />
          </div>
        )}

        {activeTab === "faculties" && (
          <div className="animate-in fade-in duration-300">
            <FacultyManager />
          </div>
        )}

        {activeTab === "subjects" && (
          <div className="animate-in fade-in duration-300">
            <SubjectManager />
          </div>
        )}
      </div>

      {/* Info Banner */}
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="border border-border rounded-lg p-6 bg-card space-y-4">
          <h3 className="text-lg font-semibold text-foreground">How It Works</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium text-foreground">Create Universities</h4>
              <p className="text-sm text-muted-foreground">
                Start by creating universities in the system.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-foreground">Add Faculties & Semesters</h4>
              <p className="text-sm text-muted-foreground">
                Select a university and add faculties with their semester count.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-foreground">Add Subjects</h4>
              <p className="text-sm text-muted-foreground">
                Assign subjects to semesters for complete hierarchy.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
