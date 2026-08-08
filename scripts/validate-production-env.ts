import { parseProductionEnv } from "../lib/production-env";

parseProductionEnv(process.env);
console.log("Production environment contract is valid.");
