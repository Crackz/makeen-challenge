import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { StackFactory } from "./factories/stack-factory";
import { LambdaStack } from "./stacks/lambda-stack";
import { ServiceKey } from "./config/service-registry";

export interface MakeenChallengeAppProps {
  env: cdk.Environment;
  stageName: string;
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

    // Create the file processor Lambda stack
    const textFileProcessorTags: Record<string, string> = {};

    if (isLocalDev) {
      textFileProcessorTags._custom_id_ = "text-file-processor";
    }

    const textFileProcessorLambdaStack = stackFactory.createLambdaStack(
      ServiceKey.TEXT_FILE_PROCESSOR,
      { databaseStack },
      { tags: textFileProcessorTags }
    );

    // Create Lambda stacks for all services/lambdas
    const lambdaStacks: Record<ServiceKey, LambdaStack> = {
      [ServiceKey.TEXT_FILE_PROCESSOR]: textFileProcessorLambdaStack,
    };

    // Create the API stack with all Lambda functions
    const apiStack = stackFactory.createApiStack({ lambdaStacks });

    // Create the monitoring stack for all resources
    const monitoringStack = stackFactory.createMonitoringStack({
      databaseStack,
      lambdaStacks,
      apiStack,
    });
  }
}
