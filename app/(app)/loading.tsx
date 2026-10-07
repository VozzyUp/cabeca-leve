import { Skeleton } from "@/components/ui/skeleton";

// Carregamento das telas que buscam dados no servidor
export default function Loading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Carregando">
      <Skeleton className="h-12 w-56" />
      <div className="grid gap-3 sm:grid-cols-3"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
      <Skeleton className="h-64" />
    </div>
  );
}
