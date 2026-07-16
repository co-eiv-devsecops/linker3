import type {
  HttpHandler,
  HttpRequest,
  HttpResponse,
} from "../../presentation/HttpPort.ts";

export interface PortableHttpResult {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

class BufferedResponse implements HttpResponse {
  statusCode = 200;
  headers: Record<string, string> = {};
  body = "";

  writeHead(status: number, headers: Record<string, string>): this {
    this.statusCode = status;
    this.headers = headers;
    return this;
  }

  end(body = ""): void {
    this.body = body;
  }

  result(): PortableHttpResult {
    return { statusCode: this.statusCode, headers: this.headers, body: this.body };
  }
}

/** Executes the common router without a cloud-provider runtime dependency. */
export async function invokeHttpHandler(
  handler: HttpHandler,
  request: HttpRequest
): Promise<PortableHttpResult> {
  const response = new BufferedResponse();
  await handler.handle(request, response);
  return response.result();
}
