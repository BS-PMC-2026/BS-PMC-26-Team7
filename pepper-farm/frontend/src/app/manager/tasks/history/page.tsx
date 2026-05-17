import { redirect } from "next/navigation";

export default function TaskHistoryRedirect() {
  redirect("/manager/tasks?tab=history");
}