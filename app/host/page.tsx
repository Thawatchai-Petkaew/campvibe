import Link from "next/link";
import { auth } from "@/lib/auth";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Sparkles, ShieldCheck, UploadCloud } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HostLandingPage() {
  const session = await auth();

  const currentUser = session?.user
    ? { name: session.user.name ?? null, image: (session.user as any).image ?? null }
    : null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar currentUser={currentUser} />

      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <div className="flex flex-col gap-6">
          <div className="inline-flex items-center gap-2">
            <Badge variant="secondary" className="rounded-full">
              <Sparkles className="w-3.5 h-3.5 mr-1" />
              Host onboarding
            </Badge>
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
              เพิ่มลานกางเต็นท์ของคุณบน CampVibe
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              ตอนนี้บัญชีของคุณยังไม่มีสิทธิ์เข้า Dashboard เพราะยังไม่มี camp site หรือ role ในทีม
              — เริ่มต้นด้วยการสร้างลานแรก แล้วระบบจะเปิดสิทธิ์ให้โดยอัตโนมัติ
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
                <UploadCloud className="w-5 h-5" />
              </div>
              <div className="font-semibold">ลงข้อมูลของคุณกับเรา</div>
              <div className="text-sm text-muted-foreground mt-1">
                กรอกข้อมูลลาน รูปภาพ ราคา และรายละเอียดให้ครบเพื่อเริ่มรับการจอง
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="font-semibold">ระบบทีม & สิทธิ์</div>
              <div className="text-sm text-muted-foreground mt-1">
                เชิญทีมงานมาช่วยดูแล พร้อมสิทธิ์ตาม role และการแจ้งเตือน
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="font-semibold">เตรียมพร้อม Onboarding</div>
              <div className="text-sm text-muted-foreground mt-1">
                เราจะเพิ่มขั้นตอน onboarding/verification เพิ่มเติมในรอบถัดไป
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Link href={session?.user ? "/host/new" : "/login?callbackUrl=/host"}>
              <Button className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 px-6">
                เริ่มเพิ่มลานของฉัน
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link href="/">
              <Button variant="outline" className="rounded-full px-6">
                กลับไปดูหน้า Camper
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

