import { redirect } from "next/navigation";

export default function InventoryReportRedirect() {
  redirect("/manager/reports?tab=inventory");
}