"use client";

import { useEffect, useState } from "react";
import { CampgroundForm } from "@/components/CampgroundForm";
import { useParams } from "next/navigation";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

export default function EditCampSitePage() {
    const params = useParams();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (params.id) {
            fetch(`/api/campsites/${params.id}`, { cache: 'no-store' })
                .then(res => res.json())
                .then(data => {
                    if (!data.error) {
                        setData(data);
                    } else {
                        alert(data.error);
                    }
                    setLoading(false);
                })
                .catch(err => {
                    console.error(err);
                    setLoading(false);
                });
        }
    }, [params.id]);

    if (loading) return <LoadingSpinner fullScreen />;

    if (!data) return <div>Camp site not found</div>;

    return <CampgroundForm initialData={data} isEditing={true} />;
}
