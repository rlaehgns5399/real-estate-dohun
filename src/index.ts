import "dotenv/config";
import { runReport } from "@/services/report";

runReport().catch((err) => {
  console.error("치명적 오류:", err);
  process.exit(1);
});
