import { redirect } from "next/navigation";
import type { Route } from "next";
import { getContextFromSearchParamsRecord, withDashboardContext } from "@/lib/context";

type TaskManagementPageProps = {
  searchParams?: Promise<{
    projectId?: string | string[];
    projectName?: string | string[];
    teamId?: string | string[];
    ctx?: string | string[];
  }>;
};

export default async function TaskManagementPage({ searchParams }: TaskManagementPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const dashboardContext = getContextFromSearchParamsRecord(
    resolvedSearchParams as Record<string, string | string[] | undefined>
  );
  const redirectPath = withDashboardContext("/tasks?tab=gestion", dashboardContext);
  redirect(redirectPath as Route);
}
