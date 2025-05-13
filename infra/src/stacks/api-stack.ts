import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

export interface ApiEndpointConfig {
  lambdaFunction: lambda.Function;
  resourcePath: string;
  methods: string[];
  apiKeyRequired?: boolean;
}

interface ApiStackProps extends cdk.StackProps {
  endpoints: ApiEndpointConfig[];
  stageName: string;
  apiName?: string;
  description?: string;
  apiKeyValue?: string;
}

export class ApiStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;
  public readonly apiKey: apigateway.ApiKey;
  public readonly usagePlan: apigateway.UsagePlan;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    // Create an API Gateway REST API
    this.api = new apigateway.RestApi(this, props.apiName || "Api", {
      description: props.description || "API Gateway for service endpoints",
      deployOptions: {
        stageName: props.stageName,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true,
        tracingEnabled: true, // Enable X-Ray tracing
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ["Content-Type", "X-Api-Key"],
        maxAge: cdk.Duration.days(1),
      },
      endpointTypes: [apigateway.EndpointType.REGIONAL], // Use REGIONAL for production
      minCompressionSize: cdk.Size.kibibytes(1), // Enable compression for responses > 1KB
    });

    // Create resources and methods for each endpoint
    props.endpoints.forEach((endpoint, index) => {
      // Split the resource path into segments and create nested resources
      const pathSegments = endpoint.resourcePath.split("/");
      let currentResource = this.api.root;

      // Create nested resources based on path segments
      pathSegments
        .filter((segment) => segment.length > 0)
        .forEach((segment) => {
          const existingResource = currentResource.getResource(segment);
          if (existingResource) {
            currentResource = existingResource;
          } else {
            currentResource = currentResource.addResource(segment);
          }
        });

      // Add methods to the resource
      endpoint.methods.forEach((method) => {
        currentResource.addMethod(
          method,
          new apigateway.LambdaIntegration(endpoint.lambdaFunction, {
            contentHandling: apigateway.ContentHandling.CONVERT_TO_TEXT,
            passthroughBehavior:
              apigateway.PassthroughBehavior.WHEN_NO_TEMPLATES,
            timeout: cdk.Duration.seconds(29), // Set integration timeout
          }),
          {
            apiKeyRequired: endpoint.apiKeyRequired !== false, // Default to true if not specified
            methodResponses: [
              {
                statusCode: "200",
                responseParameters: {
                  "method.response.header.Access-Control-Allow-Origin": true,
                  "method.response.header.Content-Type": true,
                },
                responseModels: {
                  "application/json": apigateway.Model.EMPTY_MODEL,
                },
              },
              {
                statusCode: "400",
                responseParameters: {
                  "method.response.header.Access-Control-Allow-Origin": true,
                  "method.response.header.Content-Type": true,
                },
                responseModels: {
                  "application/json": apigateway.Model.ERROR_MODEL,
                },
              },
              {
                statusCode: "500",
                responseParameters: {
                  "method.response.header.Access-Control-Allow-Origin": true,
                  "method.response.header.Content-Type": true,
                },
                responseModels: {
                  "application/json": apigateway.Model.ERROR_MODEL,
                },
              },
            ],
            requestParameters: {
              "method.request.header.Content-Type": true,
            },
            requestValidatorOptions: {
              validateRequestBody: true,
              validateRequestParameters: true,
            },
          }
        );
      });
    });

    // Monitoring has been moved to the dedicated MonitoringStack

    // Create API key and usage plan
    // Create API key with optional fixed value for development environments
    this.apiKey = new apigateway.ApiKey(this, `${props.apiName || "Api"}Key`, {
      enabled: true,
      description: `API Key for ${props.apiName || "API"} service (${props.stageName})`,
      value: props.apiKeyValue, // If provided, use fixed value; otherwise, AWS generates a random one
    });

    this.usagePlan = new apigateway.UsagePlan(
      this,
      `${props.apiName || "Api"}UsagePlan`,
      {
        name: `${props.apiName || "Api"}UsagePlan-${props.stageName}`,
        description: `Usage plan for ${props.apiName || "API"} (${props.stageName})`,
        apiStages: [
          {
            api: this.api,
            stage: this.api.deploymentStage,
          },
        ],
        throttle: {
          rateLimit: 10, // Maximum requests per second
          burstLimit: 20, // Maximum concurrent requests
        },
        quota: {
          limit: 1000, // Maximum requests per period
          period: apigateway.Period.DAY, // Period for the quota
        },
      }
    );

    this.usagePlan.addApiKey(this.apiKey);

    // Output the API key ID
    new cdk.CfnOutput(this, "ApiKeyId", {
      value: this.apiKey.keyId,
      description: `API Key ID for the ${props.apiName || "API"} service (${props.stageName})`,
      exportName: `${props.apiName || "Api"}KeyId-${props.stageName}`,
    });

    // Output the API endpoint URL
    new cdk.CfnOutput(this, "ApiEndpoint", {
      value: this.api.url,
      description: `API Gateway endpoint URL for the ${props.apiName || "API"} service (${props.stageName})`,
      exportName: `${props.apiName || "Api"}Endpoint-${props.stageName}`,
    });
  }
}
