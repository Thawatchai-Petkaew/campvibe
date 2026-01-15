"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

export default function EditCampgroundRedirectPage() {
    const router = useRouter();
    const params = useParams();
    
    useEffect(() => {
        if (params.id) {
            router.replace(`/dashboard/campsites/${params.id}/edit`);
        }
    }, [router, params.id]);

    return (
        <div className="flex h-64 items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
    );
}
