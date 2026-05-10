import { Hojas2516Nav } from "./_nav";

export default async function Formato2516Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string; declId: string }>;
}) {
  const { id: empresaId, declId } = await params;
  return (
    <div>
      <Hojas2516Nav empresaId={empresaId} declId={declId} />
      {children}
    </div>
  );
}
