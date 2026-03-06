import { z } from "zod";

export const configSchema = z.object({
  workspace: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    path: z.string().min(1)
  }),
  models: z.object({
    router: z.string().default("vercel-ai-gateway"),
    defaultModel: z.string().default("gpt-5"),
    fallbackModel: z.string().default("gpt-5-mini")
  }),
  tools: z.object({
    approvals: z.object({
      mode: z.enum(["off", "smart", "strict"]).default("smart"),
      highRiskAlways: z.boolean().default(true)
    })
  }),
  views: z.object({
    primary: z.enum(["founder", "agency", "developer", "creator", "personal", "fitness"]),
    overlays: z
      .array(z.enum(["founder", "agency", "developer", "creator", "personal", "fitness"]))
      .default([])
  })
});

export type ClawsConfig = z.infer<typeof configSchema>;
