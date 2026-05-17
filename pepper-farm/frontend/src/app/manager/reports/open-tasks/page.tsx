import { redirect } from "next/navigation";

export default function OpenTasksReportRedirect() {
  redirect("/manager/reports?tab=open-tasks");
}