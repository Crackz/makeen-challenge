import * as cdk from "aws-cdk-lib";
import { ServiceKey } from "./config/service-registry";
import { StackFactory } from "./factories/stack-factory";
import { LambdaStack } from "./stacks/lambda-stack";
import { EnvironmentName } from "./config/environment-config";

export interface MakeenChallengeAppProps {
  env: cdk.Environment;
  stageName: EnvironmentName;
}

export class MakeenChallengeApp {
  constructor(app: cdk.App, props: MakeenChallengeAppProps) {
    const isLocalDev = props.stageName === "dev";

    // Create a stack factory
    const stackFactory = new StackFactory({
      app,
      env: props.env,
      stageName: props.stageName,
    });

    // Create the database stack
    const databaseStack = stackFactory.createDatabaseStack();

    const textFileProcessorLambdaStack = stackFactory.createLambdaStack(
      ServiceKey.TEXT_FILE_PROCESSOR,
      { databaseStack }
    );

    // Create Lambda stacks for all services/lambdas
    const lambdaStacks: Record<ServiceKey, LambdaStack> = {
      [ServiceKey.TEXT_FILE_PROCESSOR]: textFileProcessorLambdaStack,
    };

    // Create the API stack with all Lambda functions
    const apiStack = stackFactory.createApiStack({ lambdaStacks });
    if (isLocalDev) {
      // The _custom_id_ tag is used by localstack to assign static domain for the API Gateway
      // Note: Adding tags during stack creation does not work with LocalStack. However, the following API does work:
      cdk.Tags.of(apiStack).add("_custom_id_", "makeen-challenge-api");
    }

    // Create the monitoring stack for all resources
    stackFactory.createMonitoringStack({
      databaseStack,
      lambdaStacks,
      apiStack,
    });
  }
}
