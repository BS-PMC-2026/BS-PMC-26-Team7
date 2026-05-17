import { redirect } from "next/navigation";

export default function AnomaliesRedirect() {
  redirect("/manager/sensors?tab=anomalies");
}
