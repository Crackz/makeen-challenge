import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import { Construct } from "constructs";

export interface MonitoringResourceConfig {
  type: "api" | "lambda" | "dynamodb";
  resource: apigateway.RestApi | lambda.Function | cdk.aws_dynamodb.Table;
  name: string;
  alarmThresholds?: {
    errors?: number;
    latency?: number;
    throttles?: number;
  };
}

interface MonitoringStackProps extends cdk.StackProps {
  resources: MonitoringResourceConfig[];
  stageName: string;
  alarmEmailSubscription?: string;
}

export class MonitoringStack extends cdk.Stack {
  public readonly alarms: Record<string, cloudwatch.Alarm[]> = {};

  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    // Create alarms for each resource
    props.resources.forEach((resourceConfig) => {
      const resourceAlarms: cloudwatch.Alarm[] = [];

      switch (resourceConfig.type) {
        case "api":
          resourceAlarms.push(
            ...this.createApiAlarms(
              resourceConfig.resource as apigateway.RestApi,
              resourceConfig.name,
              props.stageName,
              resourceConfig.alarmThresholds
            )
          );
          break;
        case "lambda":
          resourceAlarms.push(
            ...this.createLambdaAlarms(
              resourceConfig.resource as lambda.Function,
              resourceConfig.name,
              resourceConfig.alarmThresholds
            )
          );
          break;
        case "dynamodb":
          resourceAlarms.push(
            ...this.createDynamoDBAlarms(
              resourceConfig.resource as cdk.aws_dynamodb.Table,
              resourceConfig.name,
              resourceConfig.alarmThresholds
            )
          );
          break;
      }

      this.alarms[resourceConfig.name] = resourceAlarms;
    });

    // Create a dashboard for all resources
    this.createDashboard(props.resources, props.stageName);

    // Create an SNS topic for alarms if email subscription is provided
    if (props.alarmEmailSubscription) {
      this.createAlarmNotification(props.alarmEmailSubscription);
    }
  }

  private createApiAlarms(
    api: apigateway.RestApi,
    name: string,
    stageName: string,
    thresholds?: { errors?: number; latency?: number; throttles?: number }
  ): cloudwatch.Alarm[] {
    const alarms: cloudwatch.Alarm[] = [];

    // API 5XX errors alarm
    const apiErrors = new cloudwatch.Metric({
      namespace: "AWS/ApiGateway",
      metricName: "5XXError",
      dimensionsMap: {
        ApiName: api.restApiName,
        Stage: stageName,
      },
      statistic: "Sum",
      period: cdk.Duration.minutes(5),
    });

    alarms.push(
      new cloudwatch.Alarm(this, `${name}ApiErrorsAlarm`, {
        metric: apiErrors,
        threshold: thresholds?.errors || 5,
        evaluationPeriods: 1,
        alarmDescription: `${name} API has a high error rate`,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      })
    );

    // API Latency alarm
    const apiLatency = new cloudwatch.Metric({
      namespace: "AWS/ApiGateway",
      metricName: "Latency",
      dimensionsMap: {
        ApiName: api.restApiName,
        Stage: stageName,
      },
      statistic: "p90",
      period: cdk.Duration.minutes(5),
    });

    alarms.push(
      new cloudwatch.Alarm(this, `${name}ApiLatencyAlarm`, {
        metric: apiLatency,
        threshold: thresholds?.latency || 5000, // 5 seconds
        evaluationPeriods: 3,
        alarmDescription: `${name} API has high latency`,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      })
    );

    return alarms;
  }

  private createLambdaAlarms(
    lambdaFunction: lambda.Function,
    name: string,
    thresholds?: { errors?: number; latency?: number; throttles?: number }
  ): cloudwatch.Alarm[] {
    const alarms: cloudwatch.Alarm[] = [];

    // Lambda errors alarm
    const lambdaErrors = new cloudwatch.Metric({
      namespace: "AWS/Lambda",
      metricName: "Errors",
      dimensionsMap: {
        FunctionName: lambdaFunction.functionName,
      },
      statistic: "Sum",
      period: cdk.Duration.minutes(5),
    });

    alarms.push(
      new cloudwatch.Alarm(this, `${name}LambdaErrorsAlarm`, {
        metric: lambdaErrors,
        threshold: thresholds?.errors || 3,
        evaluationPeriods: 1,
        alarmDescription: `${name} Lambda function has errors`,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      })
    );

    // Lambda duration alarm
    const lambdaDuration = new cloudwatch.Metric({
      namespace: "AWS/Lambda",
      metricName: "Duration",
      dimensionsMap: {
        FunctionName: lambdaFunction.functionName,
      },
      statistic: "p90",
      period: cdk.Duration.minutes(5),
    });

    alarms.push(
      new cloudwatch.Alarm(this, `${name}LambdaDurationAlarm`, {
        metric: lambdaDuration,
        threshold: thresholds?.latency || (lambdaFunction.timeout ? lambdaFunction.timeout.toMilliseconds() * 0.8 : 3000), // 80% of timeout
        evaluationPeriods: 3,
        alarmDescription: `${name} Lambda function duration is high`,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      })
    );

    // Lambda throttles alarm
    const lambdaThrottles = new cloudwatch.Metric({
      namespace: "AWS/Lambda",
      metricName: "Throttles",
      dimensionsMap: {
        FunctionName: lambdaFunction.functionName,
      },
      statistic: "Sum",
      period: cdk.Duration.minutes(5),
    });

    alarms.push(
      new cloudwatch.Alarm(this, `${name}LambdaThrottlesAlarm`, {
        metric: lambdaThrottles,
        threshold: thresholds?.throttles || 5,
        evaluationPeriods: 1,
        alarmDescription: `${name} Lambda function is being throttled`,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      })
    );

    return alarms;
  }

  private createDynamoDBAlarms(
    table: cdk.aws_dynamodb.Table,
    name: string,
    thresholds?: { throttles?: number }
  ): cloudwatch.Alarm[] {
    const alarms: cloudwatch.Alarm[] = [];

    // DynamoDB throttled requests alarm
    const dynamoDBThrottles = new cloudwatch.Metric({
      namespace: "AWS/DynamoDB",
      metricName: "ThrottledRequests",
      dimensionsMap: {
        TableName: table.tableName,
      },
      statistic: "Sum",
      period: cdk.Duration.minutes(5),
    });

    alarms.push(
      new cloudwatch.Alarm(this, `${name}DynamoDBThrottlesAlarm`, {
        metric: dynamoDBThrottles,
        threshold: thresholds?.throttles || 10,
        evaluationPeriods: 1,
        alarmDescription: `${name} DynamoDB table is experiencing throttled requests`,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      })
    );

    return alarms;
  }

  private createDashboard(
    resources: MonitoringResourceConfig[],
    stageName: string
  ): void {
    const dashboard = new cloudwatch.Dashboard(
      this,
      `${stageName}Dashboard`,
      {
        dashboardName: `MakeenChallenge-${stageName}`,
      }
    );

    // Add widgets for each resource
    const widgets: cloudwatch.IWidget[] = [];

    resources.forEach((resourceConfig) => {
      switch (resourceConfig.type) {
        case "api":
          widgets.push(
            this.createApiWidgets(
              resourceConfig.resource as apigateway.RestApi,
              resourceConfig.name,
              stageName
            )
          );
          break;
        case "lambda":
          widgets.push(
            this.createLambdaWidgets(
              resourceConfig.resource as lambda.Function,
              resourceConfig.name
            )
          );
          break;
        case "dynamodb":
          widgets.push(
            this.createDynamoDBWidgets(
              resourceConfig.resource as cdk.aws_dynamodb.Table,
              resourceConfig.name
            )
          );
          break;
      }
    });

    dashboard.addWidgets(...widgets);
  }

  private createApiWidgets(
    api: apigateway.RestApi,
    name: string,
    stageName: string
  ): cloudwatch.IWidget {
    return new cloudwatch.GraphWidget({
      title: `${name} API Metrics`,
      left: [
        new cloudwatch.Metric({
          namespace: "AWS/ApiGateway",
          metricName: "Count",
          dimensionsMap: {
            ApiName: api.restApiName,
            Stage: stageName,
          },
          statistic: "Sum",
          period: cdk.Duration.minutes(5),
        }),
        new cloudwatch.Metric({
          namespace: "AWS/ApiGateway",
          metricName: "4XXError",
          dimensionsMap: {
            ApiName: api.restApiName,
            Stage: stageName,
          },
          statistic: "Sum",
          period: cdk.Duration.minutes(5),
        }),
        new cloudwatch.Metric({
          namespace: "AWS/ApiGateway",
          metricName: "5XXError",
          dimensionsMap: {
            ApiName: api.restApiName,
            Stage: stageName,
          },
          statistic: "Sum",
          period: cdk.Duration.minutes(5),
        }),
      ],
      right: [
        new cloudwatch.Metric({
          namespace: "AWS/ApiGateway",
          metricName: "Latency",
          dimensionsMap: {
            ApiName: api.restApiName,
            Stage: stageName,
          },
          statistic: "p50",
          period: cdk.Duration.minutes(5),
        }),
        new cloudwatch.Metric({
          namespace: "AWS/ApiGateway",
          metricName: "Latency",
          dimensionsMap: {
            ApiName: api.restApiName,
            Stage: stageName,
          },
          statistic: "p90",
          period: cdk.Duration.minutes(5),
        }),
        new cloudwatch.Metric({
          namespace: "AWS/ApiGateway",
          metricName: "Latency",
          dimensionsMap: {
            ApiName: api.restApiName,
            Stage: stageName,
          },
          statistic: "p99",
          period: cdk.Duration.minutes(5),
        }),
      ],
      width: 24,
      height: 6,
    });
  }

  private createLambdaWidgets(
    lambdaFunction: lambda.Function,
    name: string
  ): cloudwatch.IWidget {
    return new cloudwatch.GraphWidget({
      title: `${name} Lambda Metrics`,
      left: [
        new cloudwatch.Metric({
          namespace: "AWS/Lambda",
          metricName: "Invocations",
          dimensionsMap: {
            FunctionName: lambdaFunction.functionName,
          },
          statistic: "Sum",
          period: cdk.Duration.minutes(5),
        }),
        new cloudwatch.Metric({
          namespace: "AWS/Lambda",
          metricName: "Errors",
          dimensionsMap: {
            FunctionName: lambdaFunction.functionName,
          },
          statistic: "Sum",
          period: cdk.Duration.minutes(5),
        }),
        new cloudwatch.Metric({
          namespace: "AWS/Lambda",
          metricName: "Throttles",
          dimensionsMap: {
            FunctionName: lambdaFunction.functionName,
          },
          statistic: "Sum",
          period: cdk.Duration.minutes(5),
        }),
      ],
      right: [
        new cloudwatch.Metric({
          namespace: "AWS/Lambda",
          metricName: "Duration",
          dimensionsMap: {
            FunctionName: lambdaFunction.functionName,
          },
          statistic: "p50",
          period: cdk.Duration.minutes(5),
        }),
        new cloudwatch.Metric({
          namespace: "AWS/Lambda",
          metricName: "Duration",
          dimensionsMap: {
            FunctionName: lambdaFunction.functionName,
          },
          statistic: "p90",
          period: cdk.Duration.minutes(5),
        }),
        new cloudwatch.Metric({
          namespace: "AWS/Lambda",
          metricName: "Duration",
          dimensionsMap: {
            FunctionName: lambdaFunction.functionName,
          },
          statistic: "p99",
          period: cdk.Duration.minutes(5),
        }),
      ],
      width: 24,
      height: 6,
    });
  }

  private createDynamoDBWidgets(
    table: cdk.aws_dynamodb.Table,
    name: string
  ): cloudwatch.IWidget {
    return new cloudwatch.GraphWidget({
      title: `${name} DynamoDB Metrics`,
      left: [
        new cloudwatch.Metric({
          namespace: "AWS/DynamoDB",
          metricName: "ConsumedReadCapacityUnits",
          dimensionsMap: {
            TableName: table.tableName,
          },
          statistic: "Sum",
          period: cdk.Duration.minutes(5),
        }),
        new cloudwatch.Metric({
          namespace: "AWS/DynamoDB",
          metricName: "ConsumedWriteCapacityUnits",
          dimensionsMap: {
            TableName: table.tableName,
          },
          statistic: "Sum",
          period: cdk.Duration.minutes(5),
        }),
      ],
      right: [
        new cloudwatch.Metric({
          namespace: "AWS/DynamoDB",
          metricName: "ThrottledRequests",
          dimensionsMap: {
            TableName: table.tableName,
          },
          statistic: "Sum",
          period: cdk.Duration.minutes(5),
        }),
        new cloudwatch.Metric({
          namespace: "AWS/DynamoDB",
          metricName: "SuccessfulRequestLatency",
          dimensionsMap: {
            TableName: table.tableName,
            Operation: "GetItem",
          },
          statistic: "p90",
          period: cdk.Duration.minutes(5),
        }),
      ],
      width: 24,
      height: 6,
    });
  }

  private createAlarmNotification(emailAddress: string): void {
    // Create an SNS topic for alarms
    const alarmTopic = new cdk.aws_sns.Topic(this, "AlarmTopic", {
      displayName: "CloudWatch Alarm Notifications",
    });

    // Add email subscription
    new cdk.aws_sns.Subscription(this, "AlarmEmailSubscription", {
      topic: alarmTopic,
      protocol: cdk.aws_sns.SubscriptionProtocol.EMAIL,
      endpoint: emailAddress,
    });

    // Add all alarms to the topic
    Object.values(this.alarms).forEach((alarmArray) => {
      alarmArray.forEach((alarm) => {
        alarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(alarmTopic));
      });
    });
  }
}
