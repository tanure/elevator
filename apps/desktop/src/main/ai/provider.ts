import type {
  AiCompletionRequest,
  AiCompletionResponse,
  AiProviderName
} from "@elevator/shared";

export interface AiProvider {
  readonly name: AiProviderName;
  complete(req: AiCompletionRequest): Promise<AiCompletionResponse>;
}
