export default function StubNotice({ children }) {
  return (
    <div className="stub-notice" role="note">
      <strong>Planned module — preview only.</strong> {children}
    </div>
  );
}
