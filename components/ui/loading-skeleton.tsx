import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function DashboardOverviewSkeleton() {
    return (
        <div className="space-y-8 animate-pulse">
            <div className="flex justify-between items-end">
                <div>
                    <Skeleton className="h-10 w-48 mb-2" />
                    <Skeleton className="h-4 w-64" />
                </div>
                <Skeleton className="h-12 w-48 rounded-full" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                    <Card key={i} className="rounded-2xl shadow-sm border-border">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-8 w-8 rounded-lg" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-8 w-16 mb-1" />
                            <Skeleton className="h-3 w-32" />
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="bg-card rounded-3xl shadow-sm border border-border overflow-hidden">
                <div className="px-6 py-6 border-b border-border/60 flex justify-between items-center">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-4 w-16" />
                </div>
                <div className="p-6 space-y-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="flex items-center space-x-4">
                            <Skeleton className="h-12 w-12 rounded-full" />
                            <div className="space-y-2 flex-1">
                                <Skeleton className="h-4 w-[250px]" />
                                <Skeleton className="h-4 w-[200px]" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
    return (
        <div className="space-y-4 animate-pulse">
            {[...Array(rows)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4 p-4 bg-card rounded-lg border border-border">
                    <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />
                    <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-full max-w-[300px]" />
                        <Skeleton className="h-3 w-full max-w-[200px]" />
                    </div>
                    <Skeleton className="h-8 w-24 rounded-full" />
                </div>
            ))}
        </div>
    );
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[...Array(count)].map((_, i) => (
                <Card key={i} className="rounded-2xl shadow-sm border-border overflow-hidden">
                    <Skeleton className="h-48 w-full" />
                    <CardContent className="p-4 space-y-2">
                        <Skeleton className="h-6 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-4 w-full" />
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
