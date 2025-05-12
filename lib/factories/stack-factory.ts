import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { DatabaseStack } from "../database-stack";
import { LambdaStack } from "../lambda-stack";
import { ApiStack, ApiEndpointConfig } from "../api-stack";
import { MonitoringStack, MonitoringResourceConfig } from "../monitoring-stack";
import { getEnvironmentConfig } from "../config/environment-config";
import { getService, ServiceDefinition } from "../config/service-registry";

export interface StackFactoryProps {
  app: cdk.App;
  env: cdk.Environment;
  stageName: string;
}

/**
 * Factory class for creating stacks with consistent naming and configuration
 */
export class StackFactory {
  private readonly app: cdk.App;
  private readonly env: cdk.Environment;
  private readonly stageName: string;
  private readonly stackNamePrefix: string;
  private readonly envConfig: ReturnType<typeof getEnvironmentConfig>;
  private readonly stacks: Record<string, cdk.Stack> = {};

  constructor(props: StackFactoryProps) {
    this.app = props.app;
    this.env = props.env;
    this.stageName = props.stageName;
    this.stackNamePrefix = `MakeenChallenge-${this.stageName}`;
    this.envConfig = getEnvironmentConfig(this.stageName);
  }

  /**
   * Create a database stack
   * @returns The created database stack
   */
  public createDatabaseStack(): DatabaseStack {
    const stackId = "Database";

    if (this.stacks[stackId]) {
      return this.stacks[stackId] as DatabaseStack;
    }

    const stack = new DatabaseStack(
      this.app,
      `${this.stackNamePrefix}-${stackId}`,
      {
        env: this.env,
        description: `Makeen Challenge Database Stack - ${this.stageName}`,
        stackName: `${this.stackNamePrefix}-${stackId}`,
        terminationProtection: this.envConfig.terminationProtection,
      }
    );

    this.stacks[stackId] = stack;
    return stack;
  }

  /**
   * Create a Lambda stack for a service
   * @param serviceKey The service key in the registry
   * @param dependencies Optional dependencies for this stack
   * @returns The created Lambda stack
   */
  public createLambdaStack(
    serviceKey: string,
    dependencies: { databaseStack: DatabaseStack }
  ): LambdaStack {
    const serviceDefinition = getService(serviceKey);
    const stackId = serviceDefinition.name;

    if (this.stacks[stackId]) {
      return this.stacks[stackId] as LambdaStack;
    }

    // Apply environment-specific settings to the service
    const serviceConfig = {
      ...serviceDefinition,
      memorySize:
        serviceDefinition.memorySize ||
        this.envConfig.lambdaSettings.memorySize,
      timeout:
        serviceDefinition.timeout || this.envConfig.lambdaSettings.timeout,
    };

    const stack = new LambdaStack(
      this.app,
      `${this.stackNamePrefix}-${stackId}`,
      {
        env: this.env,
        description: `Makeen Challenge ${stackId} Lambda Stack - ${this.stageName}`,
        stackName: `${this.stackNamePrefix}-${stackId}`,
        tables: dependencies.databaseStack.getTables(),
        service: serviceConfig,
        terminationProtection: this.envConfig.terminationProtection,
      }
    );

    // Add dependencies
    stack.addDependency(dependencies.databaseStack);

    this.stacks[stackId] = stack;
    return stack;
  }

  /**
   * Create an API stack for multiple services
   * @param dependencies Dependencies for this stack
   * @returns The created API stack
   */
  public createApiStack(dependencies: {
    lambdaStacks: Record<string, LambdaStack>;
  }): ApiStack {
    const stackId = "Api";

    if (this.stacks[stackId]) {
      return this.stacks[stackId] as ApiStack;
    }

    // Collect API endpoints from all services
    const apiEndpoints: ApiEndpointConfig[] = [];

    Object.entries(dependencies.lambdaStacks).forEach(
      ([serviceKey, lambdaStack]) => {
        const serviceDefinition = getService(serviceKey);

        if (serviceDefinition.apiEndpoints) {
          serviceDefinition.apiEndpoints.forEach((endpoint) => {
            apiEndpoints.push({
              lambdaFunction: lambdaStack.lambdaFunction,
              resourcePath: endpoint.resourcePath,
              methods: endpoint.methods,
              apiKeyRequired: endpoint.apiKeyRequired,
            });
          });
        }
      }
    );

    const stack = new ApiStack(this.app, `${this.stackNamePrefix}-${stackId}`, {
      env: this.env,
      description: `Makeen Challenge API Stack - ${this.stageName}`,
      stackName: `${this.stackNamePrefix}-${stackId}`,
      endpoints: apiEndpoints,
      apiName: "MakeenChallengeApi",
      stageName: this.stageName,
      terminationProtection: this.envConfig.terminationProtection,
    });

    // Add dependencies
    Object.values(dependencies.lambdaStacks).forEach((lambdaStack) => {
      stack.addDependency(lambdaStack);
    });

    this.stacks[stackId] = stack;
    return stack;
  }

  /**
   * Create a monitoring stack for all resources
   * @param dependencies Dependencies for this stack
   * @returns The created monitoring stack
   */
  public createMonitoringStack(dependencies: {
    databaseStack: DatabaseStack;
    lambdaStacks: Record<string, LambdaStack>;
    apiStack: ApiStack;
  }): MonitoringStack {
    const stackId = "Monitoring";

    if (this.stacks[stackId]) {
      return this.stacks[stackId] as MonitoringStack;
    }

    // Collect monitoring resources from all stacks
    const monitoringResources: MonitoringResourceConfig[] = [];

    // Add API monitoring
    monitoringResources.push({
      type: "api",
      resource: dependencies.apiStack.api,
      name: "MakeenChallengeApi",
      alarmThresholds: {
        errors: this.envConfig.monitoringSettings.alarmThresholds.apiErrors,
        latency: this.envConfig.monitoringSettings.alarmThresholds.apiLatency,
      },
    });

    // Add Lambda monitoring for each service
    Object.entries(dependencies.lambdaStacks).forEach(
      ([serviceKey, lambdaStack]) => {
        const serviceDefinition = getService(serviceKey);

        monitoringResources.push({
          type: "lambda",
          resource: lambdaStack.lambdaFunction,
          name: serviceDefinition.name,
          alarmThresholds: {
            errors:
              this.envConfig.monitoringSettings.alarmThresholds.lambdaErrors,
            latency: lambdaStack.lambdaFunction.timeout
              ? lambdaStack.lambdaFunction.timeout.toMilliseconds() *
                this.envConfig.monitoringSettings.alarmThresholds
                  .lambdaLatencyPercentage
              : 3000,
            throttles:
              this.envConfig.monitoringSettings.alarmThresholds.lambdaThrottles,
          },
        });
      }
    );

    // Add DynamoDB monitoring
    monitoringResources.push({
      type: "dynamodb",
      resource: dependencies.databaseStack.fileDataTable,
      name: "FileDataTable",
      alarmThresholds: {
        throttles:
          this.envConfig.monitoringSettings.alarmThresholds.dynamoDBThrottles,
      },
    });

    const stack = new MonitoringStack(
      this.app,
      `${this.stackNamePrefix}-${stackId}`,
      {
        env: this.env,
        description: `Makeen Challenge Monitoring Stack - ${this.stageName}`,
        stackName: `${this.stackNamePrefix}-${stackId}`,
        resources: monitoringResources,
        stageName: this.stageName,
        alarmEmailSubscription:
          this.envConfig.monitoringSettings.alarmEmailSubscription,
        terminationProtection: this.envConfig.terminationProtection,
      }
    );

    // Add dependencies
    stack.addDependency(dependencies.apiStack);
    Object.values(dependencies.lambdaStacks).forEach((lambdaStack) => {
      stack.addDependency(lambdaStack);
    });
    stack.addDependency(dependencies.databaseStack);

    this.stacks[stackId] = stack;
    return stack;
  }
}
