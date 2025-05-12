import * as lambda from "aws-cdk-lib/aws-lambda";
import * as cdk from "aws-cdk-lib";
import { TableAccessType } from "../lambda-stack";
import { TABLE_NAMES } from "../database-stack";

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
    methods: string[];
    apiKeyRequired?: boolean;
  }[];
}

// Registry of all services in the application
export const SERVICES: Record<string, ServiceDefinition> = {
  fileProcessor: {
    name: "FileProcessor",
    description: "Processes uploaded text files",
    path: "../src/services/text-file-processor/dist",
    handler: "main.handler",
    runtime: lambda.Runtime.NODEJS_22_X,
    tableAccess: [
      {
        tableName: TABLE_NAMES.FILE_DATA,
        accessType: TableAccessType.WRITE,
      },
    ],
    apiEndpoints: [
      {
        resourcePath: "files",
        methods: ["POST"],
        apiKeyRequired: true,
      },
    ],
  },
  // Add more services here as needed
};

/**
 * Get a service definition by its key
 * @param key The service key in the registry
 * @returns The service definition
 */
export function getService(key: string): ServiceDefinition {
  if (!SERVICES[key]) {
    throw new Error(`Unknown service: ${key}`);
  }

  return SERVICES[key];
}

/**
 * Get all services in the registry
 * @returns All service definitions
 */
export function getAllServices(): Record<string, ServiceDefinition> {
  return { ...SERVICES };
}
