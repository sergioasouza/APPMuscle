import { notFound } from "next/navigation";
import { ExerciseDetailPageClient } from "@/features/workouts/components/exercise-detail-page-client";
import { getExerciseDetail } from "@/features/workouts/service";

interface ExerciseDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ExerciseDetailPage({
  params,
}: ExerciseDetailPageProps) {
  const { id } = await params;
  const exerciseDetail = await getExerciseDetail(id);

  if (!exerciseDetail) {
    notFound();
  }

  return <ExerciseDetailPageClient initialData={exerciseDetail} />;
}
