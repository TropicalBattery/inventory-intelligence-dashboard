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
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 12,
          marginBottom: 24,
        }}
      >
        {[...Array(2)].map((_, i) => (
          <div
            key={i}
            style={{
              height: 80,
              borderRadius: "var(--border-radius-lg)",
              background: "var(--color-background-secondary)",
            }}
            className="animate-pulse"
          />
        ))}
      </div>
      {[...Array(6)].map((_, i) => (
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
