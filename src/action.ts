import { runAction } from "./action-core.js";

runAction().catch((error) => {
  console.error("Unexpected error:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
