"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { secondaryButtonClass } from "@/components/ui";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    try {
      await fetch("/api/staff/logout", { method: "POST" });
    } finally {
      router.push("/staff/login");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      className={secondaryButtonClass}
      onClick={onClick}
      disabled={loading}
    >
      {loading ? "Signing out…" : "Sign out"}
    </button>
  );
}
