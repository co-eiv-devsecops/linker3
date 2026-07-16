import { invokeHttpHandler } from "../infrastructure/http/ServerlessAdapter.ts";
import { getServerlessApplication } from "./runtime.ts";

export interface AzureHttpRequest {
  method?: string;
  url?: string;
  text(): Promise<string>;
}

export interface AzureHttpResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

/** Azure Functions HTTP handler without a dependency on the Azure SDK types. */
export async function handler(request: AzureHttpRequest): Promise<AzureHttpResponse> {
  const parsed = new URL(request.url ?? "http://localhost/");
  const result = await invokeHttpHandler(getServerlessApplication().router, {
    method: request.method ?? "GET",
    url: `${parsed.pathname}${parsed.search}`,
    readBody: () => request.text(),
  });
  return { status: result.statusCode, headers: result.headers, body: result.body };
}
