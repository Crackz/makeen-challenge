import * as lambda from "aws-cdk-lib/aws-lambda";
import * as cdk from "aws-cdk-lib";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import { TableAccessType } from "../stacks/lambda-stack";
import { TABLE_NAMES } from "../stacks/database-stack";

export enum ServiceKey {
  TEXT_FILE_PROCESSOR = "textFileProcessor",
}

export interface ServiceDefinition {
  name: string;
  description: string;
  path: string;
  handler: string;
  runtime: lambda.Runtime;
  memorySize?: number;
  timeout?: cdk.Duration;
  environment?: Record<string, string>;
  tableAccess: {
    tableName: string;
    accessType: TableAccessType;
  }[];
  apiEndpoints?: {
    resourcePath: string;
    methods: apigwv2.HttpMethod[];
    apiKeyRequired?: boolean;
    binaryMediaTypes?: string[];
  }[];
}

// Registry of all services in the application
export const SERVICES: Record<ServiceKey, ServiceDefinition> = {
  textFileProcessor: {
    name: "TextFileProcessor",
    description: "Processes uploaded text files",
    path: "apps/text-file-processor/dist",
    handler: "main.handler",
    runtime: lambda.Runtime.NODEJS_22_X,
    tableAccess: [
      {
        tableName: TABLE_NAMES.TEXT_FILES,
        accessType: TableAccessType.WRITE,
      },
    ],
    apiEndpoints: [
      {
        resourcePath: "text-files",
        methods: [apigwv2.HttpMethod.POST],
        apiKeyRequired: true,
        binaryMediaTypes: ["multipart/form-data"],
      },
    ],
    environment: {
      TEXT_FILES_TABLE_NAME: TABLE_NAMES.TEXT_FILES,
    },
  },
};

/**
 * Get a service definition by its key
 * @param key The service key in the registry
 * @returns The service definition
 */
export function getService(key: ServiceKey): ServiceDefinition {
  if (!SERVICES[key]) {
    throw new Error(`Unknown service: ${key}`);
  }

  return SERVICES[key];
}

/**
 * Get all services in the registry
 * @returns All service definitions
 */
export function getAllServices(): Record<ServiceKey, ServiceDefinition> {
  return { ...SERVICES };
}
