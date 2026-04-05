import { ExerciseLibraryPageClient } from "@/features/workouts/components/exercise-library-page-client";
import { listExerciseLibrary } from "@/features/workouts/service";

export default async function ExerciseLibraryPage() {
  const exerciseLibrary = await listExerciseLibrary();

  return <ExerciseLibraryPageClient initialData={exerciseLibrary} />;
}
