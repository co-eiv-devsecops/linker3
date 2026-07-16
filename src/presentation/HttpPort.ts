/** Provider-neutral request consumed by Linker's presentation layer. */
export interface HttpRequest {
  method?: string;
  url?: string;
  readBody?: () => Promise<string>;
}

/** Provider-neutral response written by Linker's presentation layer. */
export interface HttpResponse {
  statusCode: number;
  writeHead(status: number, headers: Record<string, string>): unknown;
  end(body?: string): unknown;
}

/** Common HTTP entry point implemented by Router. */
export interface HttpHandler {
  handle(request: HttpRequest, response: HttpResponse): Promise<void>;
}
