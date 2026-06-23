// Exclude from sitemap when one is added (noindex below already covers crawlers).
import type { Metadata } from "next";
import { PreviewClient } from "./PreviewClient";

export const metadata: Metadata = {
    title: "Design Preview — CampVibe",
    robots: { index: false, follow: false },
};

export default function PreviewPage() {
    return <PreviewClient />;
}
