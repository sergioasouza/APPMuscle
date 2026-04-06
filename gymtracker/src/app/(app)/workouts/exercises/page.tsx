import { ExerciseLibraryPageClient } from "@/features/workouts/components/exercise-library-page-client";
import { listExerciseLibrary } from "@/features/workouts/service";

interface ExerciseLibraryPageProps {
  searchParams?: Promise<{
    search?: string;
    status?: string;
    source?: string;
    page?: string;
    pageSize?: string;
  }>;
}

export default async function ExerciseLibraryPage({
  searchParams,
}: ExerciseLibraryPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const pageKey = [
    resolvedSearchParams?.search ?? "",
    resolvedSearchParams?.status ?? "",
    resolvedSearchParams?.source ?? "",
    resolvedSearchParams?.page ?? "",
    resolvedSearchParams?.pageSize ?? "",
  ].join("|");
  const exerciseLibrary = await listExerciseLibrary({
    search: resolvedSearchParams?.search,
    statusFilter: resolvedSearchParams?.status,
    sourceFilter: resolvedSearchParams?.source,
    page: resolvedSearchParams?.page,
    pageSize: resolvedSearchParams?.pageSize,
  });

  return (
    <ExerciseLibraryPageClient key={pageKey} initialData={exerciseLibrary} />
  );
}
