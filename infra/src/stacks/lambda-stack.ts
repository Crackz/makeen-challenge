/// <reference types="node" />
import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import * as path from "path";
import { EnvironmentName } from "../config/environment-config";

// Define table permission types
export enum TableAccessType {
  READ = "read",
  WRITE = "write",
  READ_WRITE = "read_write",
  FULL = "full", // Includes admin operations
  NONE = "none",
}

// Define table access configuration
export interface TableAccessConfig {
  tableName: string; // Logical name to reference the table (not the actual DynamoDB table name)
  accessType: TableAccessType;
}

// Define a service configuration interface
export interface ServiceConfig {
  name: string;
  path: string;
  handler: string;
  runtime: lambda.Runtime;
  environment?: Record<string, string>;
  timeout?: cdk.Duration;
  memorySize?: number;
  tableAccess?: TableAccessConfig[];
}

interface LambdaStackProps extends cdk.StackProps {
  tables: Record<string, dynamodb.Table>; // Map of table logical names to actual DynamoDB tables
  service: ServiceConfig;
  stageName: EnvironmentName;
}

export class LambdaStack extends cdk.Stack {
  public readonly lambdaFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: LambdaStackProps) {
    super(scope, id, props);
    // Determine if we're using LocalStack
    const isLocalDev = props.stageName === "dev";
    const serviceConfig = props.service;

    // Create a log group for the Lambda function
    const logGroup = new logs.LogGroup(this, `${serviceConfig.name}LogGroup`, {
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Merge default environment with service-specific environment
    const environment: Record<string, string> = {
      NODE_ENV: isLocalDev ? "development" : "production",
      ...serviceConfig.environment,
    };

    // Add table names to environment variables
    if (props.tables) {
      Object.entries(props.tables).forEach(([logicalName, table]) => {
        environment[`${logicalName.toUpperCase()}_TABLE_NAME`] =
          table.tableName;
      });
    }
    // Set up Lambda code source based on environment
    let lambdaCode: lambda.Code;

    if (isLocalDev) {
      // For LocalStack, use the special hot-reload bucket for automatic reloading
      console.log(
        "LocalStack environment detected, setting up hot-reload for Lambda"
      );

      const hotReloadBucket = s3.Bucket.fromBucketName(
        this,
        "HotReloadBucket",
        "hot-reload"
      );
      const projectRoot = process.env.ROOT_FOLDER_PATH;
      if (!projectRoot) {
        throw new Error("ROOT_FOLDER_PATH environment variable is not set");
      }
      const functionPath = path.join(projectRoot, serviceConfig.path);

      lambdaCode = lambda.Code.fromBucket(hotReloadBucket, functionPath);
    } else {
      const projectRoot = path.resolve(__dirname, "../../../..");
      const functionPath = path.join(projectRoot, serviceConfig.path);

      // For AWS, use the standard asset approach
      lambdaCode = lambda.Code.fromAsset(functionPath);
    }

    // Create the Lambda function with the pre-built code
    this.lambdaFunction = new lambda.Function(
      this,
      `${serviceConfig.name}Function`,
      {
        code: lambdaCode,
        runtime: serviceConfig.runtime,
        handler: serviceConfig.handler,
        environment,
        timeout: serviceConfig.timeout || cdk.Duration.seconds(60),
        memorySize: serviceConfig.memorySize || 1024,
        logGroup,
        tracing: lambda.Tracing.ACTIVE, // Enable X-Ray tracing for production monitoring
        retryAttempts: 2, // Add retry capability for resilience,
      }
    );

    // Grant table access based on configuration
    if (serviceConfig.tableAccess && serviceConfig.tableAccess.length > 0) {
      serviceConfig.tableAccess.forEach((access) => {
        const table = props.tables[access.tableName];
        if (table) {
          switch (access.accessType) {
            case TableAccessType.READ:
              table.grantReadData(this.lambdaFunction);
              break;
            case TableAccessType.WRITE:
              table.grantWriteData(this.lambdaFunction);
              break;
            case TableAccessType.READ_WRITE:
              table.grantReadWriteData(this.lambdaFunction);
              break;
            case TableAccessType.FULL:
              table.grant(this.lambdaFunction, "dynamodb:*");
              break;
            case TableAccessType.NONE:
            default:
              // No permissions granted
              break;
          }
        }
      });
    }
  }
}
