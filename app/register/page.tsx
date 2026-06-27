import { notFound } from "next/navigation";

// Registration is modal-based (see RegisterModal + Navbar).
// This standalone page is intentionally removed — /register now returns 404.
export default function RegisterPage() {
    notFound();
}
