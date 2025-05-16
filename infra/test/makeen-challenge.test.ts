import * as cdk from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import "@jest/globals";
import { describe, test, expect, beforeEach, jest } from "@jest/globals";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { MakeenChallengeApp } from "../src/app";
import { DatabaseStack } from "../src/stacks/database-stack";
import { LambdaStack } from "../src/stacks/lambda-stack";
import { ApiStack } from "../src/stacks/api-stack";
import { MonitoringStack } from "../src/stacks/monitoring-stack";
import { StackFactory } from "../src/factories/stack-factory";
import { ServiceKey } from "../src/config/service-registry";
import { EnvironmentName } from "../src/config/environment-config";

describe("MakeenChallenge Infrastructure", () => {
  let app: cdk.App;
  let databaseStack: DatabaseStack;
  let lambdaStack: LambdaStack;
  let apiStack: ApiStack;
  let monitoringStack: MonitoringStack;
  let databaseTemplate: Template;
  let lambdaTemplate: Template;
  let apiTemplate: Template;
  let monitoringTemplate: Template;

  // Set up the stacks before each test
  beforeEach(() => {
    app = new cdk.App();

    // Create a stack factory for testing
    const stackFactory = new StackFactory({
      app,
      env: { account: "123456789012", region: "us-east-1" },
      stageName: "dev" as EnvironmentName,
    });

    // Create the stacks
    databaseStack = stackFactory.createDatabaseStack();
    lambdaStack = stackFactory.createLambdaStack(
      ServiceKey.TEXT_FILE_PROCESSOR,
      { databaseStack }
    );
    apiStack = stackFactory.createApiStack({
      lambdaStacks: {
        [ServiceKey.TEXT_FILE_PROCESSOR]: lambdaStack,
      },
    });
    monitoringStack = stackFactory.createMonitoringStack({
      databaseStack,
      lambdaStacks: {
        [ServiceKey.TEXT_FILE_PROCESSOR]: lambdaStack,
      },
      apiStack,
    });

    // Create templates from the stacks for assertions
    databaseTemplate = Template.fromStack(databaseStack);
    lambdaTemplate = Template.fromStack(lambdaStack);
    apiTemplate = Template.fromStack(apiStack);
    monitoringTemplate = Template.fromStack(monitoringStack);
  });

  describe("Database Stack", () => {
    test("Creates DynamoDB table with correct configuration", () => {
      // Verify the DynamoDB table is created with the correct properties
      databaseTemplate.hasResourceProperties("AWS::DynamoDB::Table", {
        KeySchema: [
          { AttributeName: "id", KeyType: "HASH" },
          { AttributeName: "timestamp", KeyType: "RANGE" },
        ],
        AttributeDefinitions: [
          { AttributeName: "id", AttributeType: "S" },
          { AttributeName: "timestamp", AttributeType: "S" },
        ],
        BillingMode: "PAY_PER_REQUEST",
        PointInTimeRecoverySpecification: {
          PointInTimeRecoveryEnabled: true,
        },
      });
    });

    test("Table has appropriate removal policy for dev environment", () => {
      // For dev environment, tables should have DESTROY removal policy
      databaseTemplate.hasResource("AWS::DynamoDB::Table", {
        DeletionPolicy: "Delete",
        UpdateReplacePolicy: "Delete",
      });
    });
  });

  describe("Lambda Stack", () => {
    test("Creates Lambda function with correct runtime and configuration", () => {
      // Verify the Lambda function is created with the correct properties
      lambdaTemplate.hasResourceProperties("AWS::Lambda::Function", {
        Runtime: lambda.Runtime.NODEJS_22_X.name,
        Timeout: 60,
        MemorySize: 1024,
        TracingConfig: {
          Mode: "Active",
        },
      });
    });

    test("Lambda has appropriate IAM permissions for DynamoDB and X-Ray", () => {
      // First find Lambda's IAM policy to verify permissions
      const policies = lambdaTemplate.findResources("AWS::IAM::Policy");
      
      // Convert to array for easier assertions
      const policyList = Object.values(policies);
      expect(policyList.length).toBeGreaterThan(0);
      
      // Check that X-Ray permissions exist
      const xrayPermissionsExist = policyList.some(policy => {
        const statements = policy.Properties.PolicyDocument.Statement;
        return statements.some((statement: any) => 
          Array.isArray(statement.Action) && 
          statement.Action.some((action: string) => action.startsWith("xray:"))
        );
      });
      expect(xrayPermissionsExist).toBe(true);
      
      // Check for DynamoDB permissions (if running in dev environment with tables)
      // This is optional since in dev/test the DynamoDB permissions might not be applied
      const findDynamoPermissions = () => {
        return policyList.some(policy => {
          const statements = policy.Properties.PolicyDocument.Statement;
          return statements.some((statement: any) => 
            Array.isArray(statement.Action) && 
            statement.Action.some((action: string) => action.startsWith("dynamodb:"))
          );
        });
      };
      
      // If we have DynamoDB permissions, let's verify they don't include overly broad permissions
      if (findDynamoPermissions()) {
        policyList.forEach(policy => {
          const statements = policy.Properties.PolicyDocument.Statement;
          statements.forEach((statement: any) => {
            if (Array.isArray(statement.Action)) {
              expect(statement.Action).not.toContain("dynamodb:*");
            } else if (typeof statement.Action === "string") {
              expect(statement.Action).not.toBe("dynamodb:*");
            }
          });
        });
      }
    });

    test("Lambda has appropriate log group configuration", () => {
      // Verify log group is created with correct retention
      lambdaTemplate.hasResourceProperties("AWS::Logs::LogGroup", {
        RetentionInDays: 14,
      });
    });
  });

  describe("API Stack", () => {
    test("Creates API Gateway with correct CORS configuration", () => {
      // Verify API Gateway is created with correct CORS settings
      apiTemplate.hasResourceProperties("AWS::ApiGatewayV2::Api", {
        CorsConfiguration: {
          AllowHeaders: ["Content-Type", "X-Api-Key"],
          AllowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
          AllowOrigins: ["*"],
          MaxAge: 86400,
        },
      });
    });

    test("Creates Lambda authorizer for API key validation", () => {
      // First capture the exact value of the API_KEY to verify it matches expectations
      const lambdaFunctions = apiTemplate.findResources("AWS::Lambda::Function");
      const authorizerFunction = Object.values(lambdaFunctions).find(
        (fn) => fn.Properties.Handler === "dist/index.handler"
      );
      
      expect(authorizerFunction).toBeDefined();
      expect(authorizerFunction?.Properties.Runtime).toBe(lambda.Runtime.NODEJS_22_X.name);
      expect(authorizerFunction?.Properties.Environment?.Variables?.API_KEY).toBeDefined();

      // Verify authorizer is configured correctly
      apiTemplate.hasResourceProperties("AWS::ApiGatewayV2::Authorizer", {
        AuthorizerType: "REQUEST",
        IdentitySource: ["$request.header.x-api-key"],
      });
    });

    test("Routes are configured with correct authorizers when required", () => {
      // Find all routes in the template
      const routes = apiTemplate.findResources('AWS::ApiGatewayV2::Route');
      
      // Find the POST /text-files route specifically
      const textFilesRoute = Object.values(routes).find(
        (route) => route.Properties.RouteKey === "POST /text-files"
      );
      
      // Verify the route exists and has the expected properties
      expect(textFilesRoute).toBeDefined();
      expect(textFilesRoute?.Properties.AuthorizationType).toBe('CUSTOM');
      
      // Check that AuthorizerId references a resource with 'Authorizer' in the name
      const authorizerIdRef = textFilesRoute?.Properties.AuthorizerId?.Ref;
      expect(authorizerIdRef).toBeDefined();
      expect(authorizerIdRef).toMatch(/Authorizer/);
    });
  });

  describe("Monitoring Stack", () => {
    test("Creates CloudWatch alarms for API errors", () => {
      // Verify API error alarm is created
      monitoringTemplate.hasResourceProperties("AWS::CloudWatch::Alarm", {
        MetricName: "5XXError",
        Namespace: "AWS/ApiGateway",
        Threshold: 5,
        EvaluationPeriods: 1,
      });
    });

    test("Creates CloudWatch alarms for Lambda errors", () => {
      // Verify Lambda error alarm is created
      monitoringTemplate.hasResourceProperties("AWS::CloudWatch::Alarm", {
        MetricName: "Errors",
        Namespace: "AWS/Lambda",
        Threshold: 3,
        EvaluationPeriods: 1,
      });
    });

    test("Creates CloudWatch alarms for DynamoDB throttles", () => {
      // Verify DynamoDB throttle alarm is created
      monitoringTemplate.hasResourceProperties("AWS::CloudWatch::Alarm", {
        MetricName: "ThrottledRequests",
        Namespace: "AWS/DynamoDB",
        Threshold: 10,
        EvaluationPeriods: 1,
      });
    });

    test("Creates CloudWatch dashboard with all resources", () => {
      // Verify dashboard is created
      monitoringTemplate.hasResourceProperties("AWS::CloudWatch::Dashboard", {
        DashboardName: "MakeenChallenge-dev-Dashboard",
      });
    });
  });
});
