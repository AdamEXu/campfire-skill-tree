"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { useMemo } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const client = useMemo(() => {
    const fallback = "https://placeholder.convex.cloud";
    return new ConvexReactClient(convexUrl ?? fallback);
  }, [convexUrl]);

  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
