"use client";

import { useState } from "react";
import { PermissionGate } from "@/components/PermissionGate";
import StudyLevelManager from "@/components/Academics/StudyLevelManager";
import BoardManager from "@/components/Academics/BoardManager";
import FacultyManager from "@/components/Academics/FacultyManager";
import SubjectManager from "@/components/Academics/SubjectManager";
import { MdSchool, MdDomain, MdGroup, MdBook } from "react-icons/md";

type TabId = "study-levels" | "boards" | "faculties" | "subjects";

const tabs: Array<{ id: TabId; label: string; icon: React.ReactNode; description: string }> = [
  {
    id: "study-levels",
    label: "Study Levels",
    icon: <MdSchool size={20} />,
    description: "Create study levels (grades, degrees, etc.)",
  },
  {
    id: "boards",
    label: "Boards",
    icon: <MdDomain size={20} />,
    description: "Create boards and assign study levels",
  },
  {
    id: "faculties",
    label: "Faculties",
    icon: <MdGroup size={20} />,
    description: "Create faculties with their unit structure",
  },
  {
    id: "subjects",
    label: "Subjects",
    icon: <MdBook size={20} />,
    description: "Create subjects within faculties",
  },
];

export default function AcademicDomainsAdmin() {
  const [activeTab, setActiveTab] = useState<TabId>("study-levels");

  return (
    <PermissionGate
      require="academic_domains:manage"
      fallback={
        <div className="min-h-screen bg-background">
          <div className="border-b border-border bg-card">
            <div className="mx-auto max-w-6xl px-4 py-8">
              <h1 className="text-3xl font-bold text-foreground">Access Denied</h1>
              <p className="text-muted-foreground mt-2">
                You don&apos;t have permission to manage academic domains.
              </p>
            </div>
          </div>
        </div>
      }
    >
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b border-border bg-card">
          <div className="mx-auto max-w-6xl px-4 py-8">
            <h1 className="text-3xl font-bold text-foreground">Academic Domains</h1>
            <p className="text-muted-foreground mt-2">
              Manage the complete hierarchy of study levels, boards, faculties, and subjects for teacher bookings.
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
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-medium transition-all whitespace-nowrap ${activeTab === tab.id
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
          {activeTab === "study-levels" && (
            <div className="animate-in fade-in duration-300">
              <StudyLevelManager />
            </div>
          )}

          {activeTab === "boards" && (
            <div className="animate-in fade-in duration-300">
              <BoardManager />
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
            <h3 className="text-lg font-semibold text-foreground">Setup Workflow</h3>
            <div className="grid md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">
                    1
                  </div>
                  <h4 className="font-medium text-foreground">Create Study Levels</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Define education levels like Grade 10, Bachelor, Master
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">
                    2
                  </div>
                  <h4 className="font-medium text-foreground">Create Boards</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Create boards (NEB, Tribhuvan Uni) and assign them to levels
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">
                    3
                  </div>
                  <h4 className="font-medium text-foreground">Create Faculties</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Add faculties (CSIT, Science) with their structure (semesters, years, etc.)
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">
                    4
                  </div>
                  <h4 className="font-medium text-foreground">Add Subjects</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Create subjects for each faculty and unit (semester/year/grade)
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PermissionGate>
  );
}
