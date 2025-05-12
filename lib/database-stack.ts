import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";

// Define table logical names as constants to ensure consistency
export const TABLE_NAMES = {
  FILE_DATA: 'fileData'
} as const;

export type TableName = keyof typeof TABLE_NAMES;

export class DatabaseStack extends cdk.Stack {
  public readonly fileDataTable: dynamodb.Table;
  private readonly tableMap: Record<string, dynamodb.Table> = {};

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create a DynamoDB table for storing processed file data
    this.fileDataTable = new dynamodb.Table(this, "FileDataTable", {
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "timestamp", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // On-demand capacity for cost efficiency
      encryption: dynamodb.TableEncryption.AWS_MANAGED, // Enable server-side encryption
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true }, // Enable point-in-time recovery for data protection
      removalPolicy: cdk.RemovalPolicy.RETAIN, // RETAIN for production to prevent accidental deletion
    });

    // Add GSI for querying by timestamp
    this.fileDataTable.addGlobalSecondaryIndex({
      indexName: "TimestampIndex",
      partitionKey: { name: "timestamp", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Output the DynamoDB table name
    new cdk.CfnOutput(this, "DynamoDBTableName", {
      value: this.fileDataTable.tableName,
      description: "DynamoDB table name for file data storage",
      exportName: "FileDataTableName",
    });

    // Output the DynamoDB table ARN
    new cdk.CfnOutput(this, "DynamoDBTableArn", {
      value: this.fileDataTable.tableArn,
      description: "DynamoDB table ARN for file data storage",
      exportName: "FileDataTableArn",
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
