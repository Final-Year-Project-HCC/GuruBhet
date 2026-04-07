/**
 * Global Loading Spinner Component
 * Displayed while the auth check is in progress
 */
export default function LoadingSpinner() {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.5)",
      }}
    >
      <div className="flex flex-col items-center gap-4">
        <div
          className="h-12 w-12 animate-spin rounded-full border-4"
          style={{
            borderColor: "var(--muted)",
            borderTopColor: "var(--primary)",
          }}
        />
        <p
          className="text-sm font-medium"
          style={{
            color: "var(--foreground)",
          }}
        >
          Loading...
        </p>
      </div>
    </div>
  );
}
