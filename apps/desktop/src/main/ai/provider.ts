import type {
  AiCompletionRequest,
  AiCompletionResponse,
  AiProviderName,
  AiStreamChunk
} from "@elevator/shared";

export interface AiProvider {
  readonly name: AiProviderName;
  complete(req: AiCompletionRequest): Promise<AiCompletionResponse>;
  /**
   * Optional streaming variant. Yields incremental text deltas as they arrive.
   * Providers that implement this MUST still produce the same final text as
   * `complete` when the deltas are concatenated. Tool calls are not streamed;
   * callers should use `complete` when tool calls may be involved.
   */
  stream?(req: AiCompletionRequest): AsyncIterable<AiStreamChunk>;
}
