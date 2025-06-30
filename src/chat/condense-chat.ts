import { langfuse } from '@/lib/langfuse';
import { model } from '@/lib/llm';
import { generateText, type CoreMessage } from 'ai';

export async function condenseMessageHistory({
  chatHistory,
  query,
  isRetry,
  sessionId,
}: {
  chatHistory: CoreMessage[];
  query: string;
  isRetry?: boolean;
  sessionId: string;
}) {
  const prompt = await langfuse.getPrompt('rag.condense', undefined, { type: 'chat' });

  const compiledPrompt = prompt.compile({
    chatHistory: chatHistory
      .map(m => `${m.role === 'user' ? 'Human' : 'Assistant'}: ${m.content}`)
      .join('\n'),
    query,
  });

  const response = await generateText({
    model,
    messages: compiledPrompt as CoreMessage[],
    temperature: isRetry ? 0.3 : 0,
    experimental_telemetry: {
      isEnabled: true,
      functionId: `Chat.OpenAI.RAG.Condense${isRetry ? '.Retry' : ''}`, // Trace name
      metadata: {
        sessionId,
        langfusePrompt: prompt.toJSON(),
      },
    },
  });

  return response.text;
}
