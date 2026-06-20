export default function Loading() {
  return (
    <div style={{ padding: "1.5rem" }}>
      <div
        style={{
          height: 28,
          width: 200,
          borderRadius: "var(--border-radius-md)",
          background: "var(--color-background-secondary)",
          marginBottom: 24,
        }}
        className="animate-pulse"
      />
      <div
        style={{
          height: 40,
          borderRadius: "var(--border-radius-md)",
          background: "var(--color-background-secondary)",
          marginBottom: 24,
        }}
        className="animate-pulse"
      />
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          style={{
            height: 44,
            borderRadius: "var(--border-radius-md)",
            background: "var(--color-background-secondary)",
            marginBottom: 8,
          }}
          className="animate-pulse"
        />
      ))}
    </div>
  );
}
