import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as apigwv2_integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as apigwv2_authorizers from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as path from "path";
import { EnvironmentName } from "../config/environment-config";

export interface ApiEndpointConfig {
  lambdaFunction: lambda.Function;
  resourcePath: string;
  methods: apigwv2.HttpMethod[];
  apiKeyRequired?: boolean;
  binaryMediaTypes?: string[];
}

interface ApiStackProps extends cdk.StackProps {
  endpoints: ApiEndpointConfig[];
  stageName: EnvironmentName;
  apiName?: string;
  description?: string;
  apiKeyValue?: string;
}

export class ApiStack extends cdk.Stack {
  public readonly api: apigwv2.HttpApi;
  public readonly stage: apigwv2.IHttpStage;
  public readonly apiKey: string;
  public readonly apiKeyAuthorizer: apigwv2_authorizers.HttpLambdaAuthorizer;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    // Create an API Gateway HTTP API (v2)
    this.api = new apigwv2.HttpApi(this, props.apiName || "Api", {
      description: props.description || "API Gateway v2 for service endpoints",
      corsPreflight: {
        allowOrigins: ["*"],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.PUT,
          apigwv2.CorsHttpMethod.DELETE,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ["Content-Type", "X-Api-Key"],
        maxAge: cdk.Duration.days(1),
      },
      createDefaultStage: true, // Create default stage for easier integration with LocalStack
    });

    // Create a log group for API access logs
    const accessLogGroup = new logs.LogGroup(
      this,
      `${props.apiName || "Api"}AccessLogs`,
      {
        retention: logs.RetentionDays.ONE_WEEK,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }
    );

    // Use the default stage that was created automatically
    this.stage = this.api.defaultStage!;

    // Generate or use provided API key
    this.apiKey = props.apiKeyValue || this.generateApiKey();

    const projectRoot = path.resolve(__dirname, "../../../..");
    // Create the API key authorizer Lambda function
    const apiKeyAuthorizerFn = new lambda.Function(
      this,
      "ApiKeyAuthorizerFunction",
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        handler: "dist/index.handler",
        code: lambda.Code.fromAsset(
          path.join(projectRoot, "apps/authorizers/api-key-authorizer")
        ),
        environment: {
          API_KEY: this.apiKey,
        },
      }
    );

    // Create the HTTP Lambda authorizer
    this.apiKeyAuthorizer = new apigwv2_authorizers.HttpLambdaAuthorizer(
      "ApiKeyAuthorizer",
      apiKeyAuthorizerFn,
      {
        authorizerName: "api-key-authorizer",
        identitySource: ["$request.header.x-api-key"],
        resultsCacheTtl: cdk.Duration.minutes(5),
      }
    );

    // Create routes and integrations for each endpoint
    props.endpoints.forEach((endpoint) => {
      // Create Lambda integration with payload format version 2.0 for better binary support
      const lambdaIntegration = new apigwv2_integrations.HttpLambdaIntegration(
        `${endpoint.resourcePath.replace(/\//g, "-")}Integration`,
        endpoint.lambdaFunction,
        {
          payloadFormatVersion: apigwv2.PayloadFormatVersion.VERSION_2_0,
        }
      );

      // Add route for each method
      endpoint.methods.forEach((method: apigwv2.HttpMethod) => {
        this.api.addRoutes({
          path: `/${endpoint.resourcePath}`,
          methods: [method],
          integration: lambdaIntegration,
          authorizer: endpoint.apiKeyRequired
            ? this.apiKeyAuthorizer
            : undefined,
        });
      });
    });

    // Output the API key
    new cdk.CfnOutput(this, "ApiKeyValue", {
      value: this.apiKey,
      description: `API Key for the ${props.apiName || "API"} service (${props.stageName})`,
      exportName: `${props.apiName || "Api"}KeyValue-${props.stageName}`,
    });

    // Output the API endpoint URL
    new cdk.CfnOutput(this, "ApiEndpoint", {
      value: this.api.apiEndpoint,
      description: `API Gateway endpoint URL for the ${props.apiName || "API"} service (${props.stageName})`,
      exportName: `${props.apiName || "Api"}Endpoint-${props.stageName}`,
    });
  }

  /**
   * Generate a random API key for development environments
   * @returns A random 32-character API key
   */
  private generateApiKey(): string {
    // Generate a random API key for development
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}
