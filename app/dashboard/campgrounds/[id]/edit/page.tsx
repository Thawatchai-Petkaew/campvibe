"use client";

import { useEffect, useState } from "react";
import { CampgroundForm } from "@/components/CampgroundForm";
import { useParams } from "next/navigation";

export default function EditCampgroundPage() {
    const params = useParams();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (params.id) {
            fetch(`/api/campgrounds/${params.id}`, { cache: 'no-store' })
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

    if (loading) return (
        <div className="flex h-screen items-center justify-center bg-gray-50">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-900"></div>
        </div>
    );

    if (!data) return <div>Campground not found</div>;

    return <CampgroundForm initialData={data} isEditing={true} />;
}
