#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { MakeenChallengeApp } from "../app";
import { EnvironmentName } from "../config/environment-config";

const app = new cdk.App();
// Determine the stage from environment variable, default to 'dev'
const stage = (process.env.STAGE as EnvironmentName) || "dev"; // Use STAGE env var, default to 'dev'

// Get environment from context or use defaults
const getEnvFromContext = (app: cdk.App): cdk.Environment => {
  // Check if we're using LocalStack
  const isLocalDev = stage === "dev";

  if (isLocalDev) {
    return {
      account: process.env.CDK_DEFAULT_ACCOUNT || "000000000000",
      region: process.env.CDK_DEFAULT_REGION || "eu-central-1",
    };
  }

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

// Create the application with the specified environment and stage
new MakeenChallengeApp(app, {
  // Pass only app and props object
  env: getEnvFromContext(app),
  stageName: stage, // Pass stage via stageName prop
});

// Tag the entire app with common tags
cdk.Tags.of(app).add("Application", "MakeenChallenge");
cdk.Tags.of(app).add("ManagedBy", "CDK");
