export default function Placeholder({
  title,
}: {
  title: string;
}) {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="text-muted-foreground">
        Disponible dans une phase suivante (voir NEW_FRONTEND_DESIGN.md).
      </p>
    </div>
  );
}
