"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isCliReachable, getSetupStatus } from "@/lib/api/localCli";

export default function CasesEntry() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    (async () => {
      const reachable = await isCliReachable();
      if (!reachable) {
        router.replace("/cases/setup");
        return;
      }
      try {
        const status = await getSetupStatus();
        const ready = status.logged_in && status.mysql_configured && status.mysql_password_set_this_session && status.doctor_mapped;
        router.replace(ready ? "/cases/submit" : "/cases/setup");
      } catch {
        router.replace("/cases/setup");
      } finally {
        setChecked(true);
      }
    })();
  }, [router]);

  return (
    <div style={{ padding: "60px 32px", textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>
      {checked ? "Redirecting…" : "Checking your setup…"}
    </div>
  );
}
