"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type PropsWithChildren } from "react";
import { useFrontendSettings } from "@/lib/frontend-settings";
import { createQueryClient } from "@/lib/query-client";

const DocumentTitleSync = () => {
  const { settings } = useFrontendSettings();

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    document.title = settings.organizationName;
  }, [settings.organizationName]);

  return null;
};

export const Providers = ({ children }: PropsWithChildren) => {
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <DocumentTitleSync />
      {children}
    </QueryClientProvider>
  );
};
