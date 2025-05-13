import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";

// Define table logical names as constants to ensure consistency
export const TABLE_NAMES = {
  FILE_DATA: "fileData",
} as const;

export type TableName = keyof typeof TABLE_NAMES;

// Define props for the DatabaseStack, extending cdk.StackProps
export interface DatabaseStackProps extends cdk.StackProps {
  stageName: string;
}

export class DatabaseStack extends cdk.Stack {
  public readonly fileDataTable: dynamodb.Table;
  private readonly tableMap: Record<string, dynamodb.Table> = {};

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    // Use DatabaseStackProps
    super(scope, id, props);

    // Always use DESTROY for local development to help with redeployment
    const isLocalDev = props.stageName === "dev";
    const removalPolicy = isLocalDev
      ? cdk.RemovalPolicy.DESTROY
      : cdk.RemovalPolicy.RETAIN;
    const encryption = isLocalDev
      ? undefined
      : dynamodb.TableEncryption.AWS_MANAGED;

    // Create a DynamoDB table for storing processed file data
    this.fileDataTable = new dynamodb.Table(this, "FileDataTable", {
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "timestamp", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // On-demand capacity for cost efficiency
      // !Note: localstack has issues with encryption setting, it keeps throwing "table is already exist"
      encryption,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true }, // Enable point-in-time recovery for data protection
      removalPolicy: removalPolicy,
    });

    // Store tables in the map for easy access
    this.tableMap[TABLE_NAMES.FILE_DATA] = this.fileDataTable;
  }

  /**
   * Get a table by its logical name
   * @param name The logical name of the table
   * @returns The DynamoDB table instance
   */
  public getTable(name: string): dynamodb.Table | undefined {
    return this.tableMap[name];
  }

  /**
   * Get all tables as a map of logical name to table instance
   * @returns A record mapping logical names to DynamoDB table instances
   */
  public getTables(): Record<string, dynamodb.Table> {
    return { ...this.tableMap };
  }
}
