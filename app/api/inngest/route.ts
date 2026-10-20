import { serve } from "inngest/next";
import { executeAgentRun } from "../../../lib/agent-worker";
import { inngest } from "../../../lib/inngest";

export const { GET, POST, PUT } = serve({ client: inngest, functions: [executeAgentRun] });