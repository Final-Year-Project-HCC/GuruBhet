"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { toast } from "react-toastify";

type SubjectLevel = "10" | "11-12" | "Bachelor" | "Master" | "Diploma";

type PublicReview = {
  id: string;
  studentName: string;
  rating: number;
  comment: string;
};

type TeacherPublicProfile = {
  fullName: string;
  subject: string;
  tagline: string;
  about: string;
  hourlyRate: number;
  profileImage: string;
  rating: number;
  totalStudents: number;
  experienceYears: number;
  levelExpertise: SubjectLevel[];
  reviews: PublicReview[];
};

const STORAGE_KEY = "teacher-public-profile";

const DEFAULT_PROFILE: TeacherPublicProfile = {
  fullName: "Your Name",
  subject: "Your Subject",
  tagline: "Add a short headline that explains what you teach best.",
  about:
    "Describe your teaching style, experience, and how you help students improve. This section is shown to students when they open your public profile.",
  hourlyRate: 1000,
  profileImage: "https://picsum.photos/seed/teacher-public/600/600",
  rating: 4.9,
  totalStudents: 150,
  experienceYears: 5,
  levelExpertise: ["11-12", "Bachelor"],
  reviews: [
    {
      id: "1",
      studentName: "Student A.",
      rating: 5,
      comment: "Very clear explanations and practical examples.",
    },
    {
      id: "2",
      studentName: "Student B.",
      rating: 4,
      comment: "Helped me understand difficult concepts quickly.",
    },
  ],
};

const LEVEL_OPTIONS: SubjectLevel[] = ["10", "11-12", "Bachelor", "Master", "Diploma"];

function parseNumber(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function getInitialProfile() {
  if (typeof window === "undefined") {
    return DEFAULT_PROFILE;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    const parsed = JSON.parse(raw) as TeacherPublicProfile;
    return {
      ...DEFAULT_PROFILE,
      ...parsed,
      fullName: parsed.fullName || DEFAULT_PROFILE.fullName,
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export default function PublicProfile() {
  const [savedProfile, setSavedProfile] = useState<TeacherPublicProfile>(() => getInitialProfile());
  const [draftProfile, setDraftProfile] = useState<TeacherPublicProfile>(() => getInitialProfile());
  const [originalName] = useState(() => getInitialProfile().fullName);

  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(savedProfile) !== JSON.stringify(draftProfile),
    [savedProfile, draftProfile],
  );

  function onTextChange<K extends keyof TeacherPublicProfile>(key: K, value: TeacherPublicProfile[K]) {
    setDraftProfile((prev) => ({ ...prev, [key]: value }));
  }

  function onToggleLevel(level: SubjectLevel) {
    setDraftProfile((prev) => {
      const exists = prev.levelExpertise.includes(level);
      const nextLevels = exists
        ? prev.levelExpertise.filter((item) => item !== level)
        : [...prev.levelExpertise, level];
      return { ...prev, levelExpertise: nextLevels };
    });
  }

  function onSave() {
    if (!draftProfile.subject.trim()) {
      toast.error("Subject is required.");
      return;
    }
    if (draftProfile.levelExpertise.length === 0) {
      toast.error("Select at least one level of expertise.");
      return;
    }
    try {
      const profileToSave: TeacherPublicProfile = {
        ...draftProfile,
        fullName: originalName,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profileToSave));
      setSavedProfile(profileToSave);
      setDraftProfile(profileToSave);
      toast.success("Public profile updated.");
    } catch {
      toast.error("Failed to save profile.");
    }
  }

  function onReset() {
    setDraftProfile(savedProfile);
    toast.info("Changes reverted.");
  }

  return (
    <main className="min-h-screen bg-background text-foreground py-8">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Public Profile Preview</h1>
            <p className="text-sm text-muted-foreground">
              This is how students see your profile. Edit on the right and save changes.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onReset}
              disabled={!hasUnsavedChanges}
              className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={!hasUnsavedChanges}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Save Profile
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 xl:grid-cols-12">
          <section className="xl:col-span-8">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
              <div className="space-y-6 lg:col-span-1">
                <article className="overflow-hidden rounded-3xl border border-border bg-background">
                  <div className="aspect-square overflow-hidden border-b border-border">
                    <Image
                      src={draftProfile.profileImage}
                      alt={draftProfile.fullName}
                      width={600}
                      height={600}
                      unoptimized
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="space-y-5 p-6 text-center">
                    <div>
                      <h2 className="text-2xl font-semibold">{draftProfile.fullName}</h2>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {draftProfile.subject}
                      </p>
                    </div>

                    <div className="grid grid-cols-3 divide-x divide-border rounded-2xl border border-border">
                      <div className="p-3">
                        <p className="text-xl font-semibold">{draftProfile.rating.toFixed(1)}</p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Rating</p>
                      </div>
                      <div className="p-3">
                        <p className="text-xl font-semibold">{draftProfile.totalStudents}+</p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Students</p>
                      </div>
                      <div className="p-3">
                        <p className="text-xl font-semibold">{draftProfile.experienceYears}</p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Years XP</p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border bg-muted/40 p-4 text-left">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Starting from</p>
                      <p className="text-2xl font-semibold">NPR {draftProfile.hourlyRate}</p>
                    </div>
                  </div>
                </article>
              </div>

              <div className="space-y-8 lg:col-span-2">
                <section className="rounded-3xl border border-border bg-background p-6">
                  <h3 className="mb-3 text-xl font-semibold">About Me</h3>
                  <p className="mb-4 text-muted-foreground">{draftProfile.tagline}</p>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">{draftProfile.about}</p>
                </section>

                <section className="rounded-3xl border border-border bg-background p-6">
                  <h3 className="mb-4 text-lg font-semibold">Expertise & Levels</h3>
                  <div className="flex flex-wrap gap-2">
                    {draftProfile.levelExpertise.map((level) => (
                      <span
                        key={level}
                        className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium"
                      >
                        {level}
                      </span>
                    ))}
                  </div>
                </section>

                <section className="rounded-3xl border border-border bg-background p-6">
                  <h3 className="mb-4 text-lg font-semibold">Recent Reviews</h3>
                  <div className="space-y-3">
                    {draftProfile.reviews.map((review) => (
                      <article key={review.id} className="rounded-2xl border border-border bg-muted/30 p-4">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-sm font-medium">{review.studentName}</p>
                          <p className="text-xs text-muted-foreground">{review.rating}/5</p>
                        </div>
                        <p className="text-sm text-muted-foreground">{review.comment}</p>
                      </article>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          </section>

          <aside className="xl:col-span-4">
            <form className="space-y-4 rounded-3xl border border-border bg-background p-6">
              <h2 className="text-lg font-semibold">Edit Public Profile</h2>

              <div>
                <label className="mb-1 block text-sm text-muted-foreground">Full Name</label>
                <input
                  value={draftProfile.fullName}
                  readOnly
                  className="w-full cursor-not-allowed rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground"
                  placeholder="Your full name"
                />
                <p className="mt-1 text-xs text-muted-foreground">Name is managed from your account profile.</p>
              </div>

              <div>
                <label className="mb-1 block text-sm text-muted-foreground">Subject</label>
                <input
                  value={draftProfile.subject}
                  onChange={(e) => onTextChange("subject", e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Subject you teach"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-muted-foreground">Tagline</label>
                <input
                  value={draftProfile.tagline}
                  onChange={(e) => onTextChange("tagline", e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Short professional tagline"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-muted-foreground">About</label>
                <textarea
                  value={draftProfile.about}
                  onChange={(e) => onTextChange("about", e.target.value)}
                  rows={5}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Describe your teaching approach"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-muted-foreground">Profile Image URL</label>
                <input
                  value={draftProfile.profileImage}
                  onChange={(e) => onTextChange("profileImage", e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="https://..."
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-muted-foreground">Hourly Rate (NPR)</label>
                  <input
                    type="number"
                    min={0}
                    value={draftProfile.hourlyRate}
                    onChange={(e) => onTextChange("hourlyRate", parseNumber(e.target.value, 0))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-muted-foreground">Rating</label>
                  <input
                    type="number"
                    min={0}
                    max={5}
                    step={0.1}
                    value={draftProfile.rating}
                    onChange={(e) => onTextChange("rating", parseNumber(e.target.value, 0))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-muted-foreground">Total Students</label>
                  <input
                    type="number"
                    min={0}
                    value={draftProfile.totalStudents}
                    onChange={(e) => onTextChange("totalStudents", parseNumber(e.target.value, 0))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-muted-foreground">Years of Experience</label>
                  <input
                    type="number"
                    min={0}
                    value={draftProfile.experienceYears}
                    onChange={(e) => onTextChange("experienceYears", parseNumber(e.target.value, 0))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm text-muted-foreground">Expertise Levels</label>
                <div className="flex flex-wrap gap-2">
                  {LEVEL_OPTIONS.map((level) => {
                    const active = draftProfile.levelExpertise.includes(level);
                    return (
                      <button
                        key={level}
                        type="button"
                        onClick={() => onToggleLevel(level)}
                        className={`rounded-full border px-3 py-1 text-xs ${
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background text-foreground"
                        }`}
                      >
                        {level}
                      </button>
                    );
                  })}
                </div>
              </div>
            </form>
          </aside>
        </div>
      </div>
    </main>
  );
}
