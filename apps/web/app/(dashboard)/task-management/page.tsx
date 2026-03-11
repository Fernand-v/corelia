import { redirect } from "next/navigation";

type TaskManagementPageProps = {
  searchParams?: Promise<{ projectId?: string | string[]; projectName?: string | string[]; teamId?: string | string[] }>;
};

const getParam = (value: string | string[] | undefined) => (Array.isArray(value) ? (value[0] ?? "") : (value ?? ""));

export default async function TaskManagementPage({ searchParams }: TaskManagementPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const params = new URLSearchParams();
  params.set("tab", "gestion");
  const projectId = getParam(resolvedSearchParams.projectId);
  const projectName = getParam(resolvedSearchParams.projectName);
  const teamId = getParam(resolvedSearchParams.teamId);

  if (projectId) {
    params.set("projectId", projectId);
  }
  if (projectName) {
    params.set("projectName", projectName);
  }
  if (teamId) {
    params.set("teamId", teamId);
  }

  redirect(`/tasks?${params.toString()}`);
}
