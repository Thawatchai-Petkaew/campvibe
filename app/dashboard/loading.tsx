import { LoadingSpinner } from "@/components/ui/loading-spinner";

export default function Loading() {
  // Render inside Dashboard layout (sidebar/header stay visible).
  return (
    <div className="w-full max-w-none px-4 md:px-6 py-6 md:py-10">
      <LoadingSpinner className="h-[55vh]" size="lg" />
    </div>
  );
}

