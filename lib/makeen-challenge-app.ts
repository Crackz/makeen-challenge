import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { StackFactory } from "./factories/stack-factory";

export interface MakeenChallengeAppProps {
  env: cdk.Environment;
  stageName: string;
}

export class MakeenChallengeApp {
  constructor(app: cdk.App, props: MakeenChallengeAppProps) {
    // Create a stack factory
    const stackFactory = new StackFactory({
      app,
      env: props.env,
      stageName: props.stageName,
    });

    // Create the database stack
    const databaseStack = stackFactory.createDatabaseStack();

    // Create Lambda stacks for all services
    const lambdaStacks: Record<string, any> = {};

    // Create the file processor Lambda stack
    lambdaStacks.fileProcessor = stackFactory.createLambdaStack(
      "fileProcessor",
      { databaseStack }
    );

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
