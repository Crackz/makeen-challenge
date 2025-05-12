#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { MakeenChallengeApp } from "../lib/makeen-challenge-app";

const app = new cdk.App();

// Get environment from context or use defaults
const getEnvFromContext = (app: cdk.App): cdk.Environment => {
  const account =
    app.node.tryGetContext("account") ||
    process.env.CDK_DEFAULT_ACCOUNT ||
    process.env.AWS_ACCOUNT_ID;
  const region =
    app.node.tryGetContext("region") ||
    process.env.CDK_DEFAULT_REGION ||
    "eu-west-1";

  if (!account || !region) {
    throw new Error(
      "Environment not fully specified. Please provide account and region via context or environment variables."
    );
  }

  return { account, region };
};

// Get stage from context or default to 'dev'
const stage = app.node.tryGetContext("stage") || "dev";

// Create the application with the specified environment and stage
new MakeenChallengeApp(app, {
  env: getEnvFromContext(app),
  stageName: stage,
});

// Tag the entire app with common tags
cdk.Tags.of(app).add("Application", "MakeenChallenge");
cdk.Tags.of(app).add("ManagedBy", "CDK");

console.log(`Synthesizing MakeenChallenge application for stage: ${stage}`);
