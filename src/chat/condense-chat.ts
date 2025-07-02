import { langfuse } from '@/lib/langfuse';
import { generateText } from '@/lib/llm';
import { type CoreMessage } from 'ai';

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
    messages: compiledPrompt as CoreMessage[],
    temperature: isRetry ? 0.3 : 0,
    langfuse: {
      name: `Chat.OpenAI.RAG.Condense${isRetry ? '.Retry' : ''}`,
      sessionId,
      prompt,
    },
  });

  return response.text;
}
