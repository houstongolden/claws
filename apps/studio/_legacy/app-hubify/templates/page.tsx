"use client";

import * as React from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import TemplatesClientPage from "./templates.client";

export default function TemplatesPage() {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Avoid running Convex hooks during prerender/SSR.
  if (!mounted) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
          <div className="space-y-10">
            {/* Hero text skeleton */}
            <div>
              <Skeleton variant="text" className="h-10 w-56 mb-3" />
              <Skeleton variant="text" className="h-5 w-80" />
            </div>

            {/* Spotlight card skeleton */}
            <Skeleton variant="card" className="h-64 rounded" />

            {/* Grid skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from({ length: 9 }).map((_, i) => (
                <Skeleton key={i} variant="card" className="h-52 rounded" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <TemplatesClientPage />;
}
