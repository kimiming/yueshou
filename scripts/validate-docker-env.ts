import { parseDockerProductionEnv } from "../lib/deployment/docker-production-env";

parseDockerProductionEnv(process.env);
console.log("Docker production environment contract is valid.");
