"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SignOutButton({ variant = "secondary" }: { variant?: "secondary" | "ghost" }) {
  const router = useRouter();
  return (
    <Button
      variant={variant}
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/auth/login");
        router.refresh();
      }}
    >
      <LogOut className="h-4 w-4" aria-hidden="true" />
      Sign out
    </Button>
  );
}
