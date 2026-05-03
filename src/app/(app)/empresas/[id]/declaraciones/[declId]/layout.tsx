import { RefreshButton } from "./refresh-button";

export default async function DeclaracionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string; declId: string }>;
}) {
  const { id, declId } = await params;
  return (
    <>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-6 z-50">
        <div className="pointer-events-auto">
          <RefreshButton empresaId={id} declId={declId} />
        </div>
      </div>
    </>
  );
}
