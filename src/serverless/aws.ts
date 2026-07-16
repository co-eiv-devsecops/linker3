import {
  invokeHttpHandler,
  type PortableHttpResult,
} from "../infrastructure/http/ServerlessAdapter.ts";
import { getServerlessApplication } from "./runtime.ts";

export interface AwsHttpEvent {
  rawPath?: string;
  rawQueryString?: string;
  path?: string;
  httpMethod?: string;
  body?: string | null;
  isBase64Encoded?: boolean;
  requestContext?: { http?: { method?: string } };
}

/** AWS Lambda handler compatible with API Gateway HTTP API v2 and REST API v1. */
export async function handler(event: AwsHttpEvent): Promise<PortableHttpResult> {
  const path = event.rawPath ?? event.path ?? "/";
  const query = event.rawQueryString ? `?${event.rawQueryString}` : "";
  const body = event.body
    ? Buffer.from(event.body, event.isBase64Encoded ? "base64" : "utf8").toString("utf8")
    : "";
  return invokeHttpHandler(getServerlessApplication().router, {
    method: event.requestContext?.http?.method ?? event.httpMethod ?? "GET",
    url: `${path}${query}`,
    readBody: async () => body,
  });
}
