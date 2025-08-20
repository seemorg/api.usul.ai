import { env } from '@/env';
import { createAzure } from '@ai-sdk/azure';
import {
  streamText as baseStreamText,
  generateText as baseGenerateText,
  smoothStream,
  ToolSet,
} from 'ai';
import type { ChatPromptClient, TextPromptClient } from 'langfuse';

const azure = createAzure({
  baseURL: env.AZURE_ENDPOINT_URL,
  apiKey: env.AZURE_SECRET_KEY,
  apiVersion: '2025-01-01-preview',
});

export const model = azure.languageModel(env.AZURE_4_1_DEPLOYMENT);
export const miniModel = azure.languageModel('usul-gpt-5-nano');

export type LangfuseTracingOptions = {
  name?: string;
  sessionId?: string;
  traceId?: string;
  prompt?: ChatPromptClient | TextPromptClient;
};

export const getLangfuseArgs = (args?: LangfuseTracingOptions) => ({
  experimental_telemetry: {
    isEnabled: true,
    ...(args?.name && { functionId: args.name }),
    metadata: {
      ...(args?.sessionId && { sessionId: args.sessionId }),
      ...(args?.traceId && { langfuseTraceId: args.traceId }),
      ...(args?.prompt && { langfusePrompt: args.prompt.toJSON() }),
    },
  },
});

export const streamText = <
  TOOLS extends ToolSet,
  OUTPUT = never,
  PARTIAL_OUTPUT = never,
>({
  langfuse,
  model: modelName = 'large',
  ...params
}: Omit<
  Parameters<typeof baseStreamText<TOOLS, OUTPUT, PARTIAL_OUTPUT>>[0],
  'model' | 'experimental_transform' | 'experimental_telemetry'
> & {
  langfuse?: LangfuseTracingOptions;
  model?: 'mini' | 'large';
}) => {
  return baseStreamText({
    model: modelName === 'mini' ? miniModel : model,
    ...params,
    experimental_transform: smoothStream(),
    ...getLangfuseArgs(langfuse),
  });
};

export const generateText = <
  TOOLS extends ToolSet,
  OUTPUT = never,
  PARTIAL_OUTPUT = never,
>({
  langfuse,
  model: modelName = 'large',
  ...params
}: Omit<
  Parameters<typeof baseGenerateText<TOOLS, OUTPUT, PARTIAL_OUTPUT>>[0],
  'model' | 'experimental_telemetry'
> & {
  langfuse?: LangfuseTracingOptions;
  model?: 'mini' | 'large';
}) => {
  return baseGenerateText({
    model: modelName === 'mini' ? miniModel : model,
    ...params,
    ...getLangfuseArgs(langfuse),
  });
};
