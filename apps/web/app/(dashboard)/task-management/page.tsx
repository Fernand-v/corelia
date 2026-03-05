import { redirect } from "next/navigation";

export default function TaskManagementPage({
  searchParams
}: {
  searchParams?: { projectId?: string; projectName?: string; teamId?: string };
}) {
  const params = new URLSearchParams();
  params.set("tab", "gestion");
  if (searchParams?.projectId) {
    params.set("projectId", searchParams.projectId);
  }
  if (searchParams?.projectName) {
    params.set("projectName", searchParams.projectName);
  }
  if (searchParams?.teamId) {
    params.set("teamId", searchParams.teamId);
  }

  redirect(`/tasks?${params.toString()}`);
}
