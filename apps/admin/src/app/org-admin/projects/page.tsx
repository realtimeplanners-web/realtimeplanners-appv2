"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function OrgAdminProjectsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the actual projects-list page
    router.replace("/projects-list");
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 dark:from-gray-900 dark:to-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Redirecting to projects...</p>
      </div>
    </div>
  );
}
