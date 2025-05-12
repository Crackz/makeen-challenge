import * as cdk from "aws-cdk-lib";

export type EnvironmentName = "dev" | "staging" | "prod";

export interface EnvironmentConfig {
  // General settings
  terminationProtection: boolean;
  
  // Database settings
  databaseSettings: {
    pointInTimeRecovery: boolean;
    removalPolicy: cdk.RemovalPolicy;
  };
  
  // Lambda settings
  lambdaSettings: {
    memorySize: number;
    timeout: cdk.Duration;
    retryAttempts: number;
    logRetentionDays: number;
  };
  
  // API settings
  apiSettings: {
    throttleRateLimit: number;
    throttleBurstLimit: number;
    quotaLimit: number;
  };
  
  // Monitoring settings
  monitoringSettings: {
    alarmEmailSubscription?: string;
    alarmThresholds: {
      apiErrors: number;
      apiLatency: number;
      lambdaErrors: number;
      lambdaLatencyPercentage: number;
      lambdaThrottles: number;
      dynamoDBThrottles: number;
    };
  };
}

// Define environment-specific configurations
const environmentConfigs: Record<EnvironmentName, EnvironmentConfig> = {
  dev: {
    terminationProtection: false,
    databaseSettings: {
      pointInTimeRecovery: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    },
    lambdaSettings: {
      memorySize: 1024,
      timeout: cdk.Duration.seconds(60),
      retryAttempts: 1,
      logRetentionDays: 7,
    },
    apiSettings: {
      throttleRateLimit: 20,
      throttleBurstLimit: 40,
      quotaLimit: 2000,
    },
    monitoringSettings: {
      alarmThresholds: {
        apiErrors: 5,
        apiLatency: 5000,
        lambdaErrors: 3,
        lambdaLatencyPercentage: 0.8,
        lambdaThrottles: 5,
        dynamoDBThrottles: 10,
      },
    },
  },
  
  staging: {
    terminationProtection: false,
    databaseSettings: {
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
    },
    lambdaSettings: {
      memorySize: 1024,
      timeout: cdk.Duration.seconds(60),
      retryAttempts: 2,
      logRetentionDays: 14,
    },
    apiSettings: {
      throttleRateLimit: 15,
      throttleBurstLimit: 30,
      quotaLimit: 1500,
    },
    monitoringSettings: {
      alarmThresholds: {
        apiErrors: 3,
        apiLatency: 4000,
        lambdaErrors: 2,
        lambdaLatencyPercentage: 0.75,
        lambdaThrottles: 3,
        dynamoDBThrottles: 7,
      },
    },
  },
  
  prod: {
    terminationProtection: true,
    databaseSettings: {
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    },
    lambdaSettings: {
      memorySize: 1536,
      timeout: cdk.Duration.seconds(60),
      retryAttempts: 2,
      logRetentionDays: 30,
    },
    apiSettings: {
      throttleRateLimit: 10,
      throttleBurstLimit: 20,
      quotaLimit: 1000,
    },
    monitoringSettings: {
      alarmEmailSubscription: "alerts@example.com",
      alarmThresholds: {
        apiErrors: 1,
        apiLatency: 3000,
        lambdaErrors: 1,
        lambdaLatencyPercentage: 0.7,
        lambdaThrottles: 1,
        dynamoDBThrottles: 5,
      },
    },
  },
};

/**
 * Get configuration for a specific environment
 * @param environment The environment name
 * @returns The environment-specific configuration
 */
export function getEnvironmentConfig(environment: string): EnvironmentConfig {
  const envName = environment as EnvironmentName;
  
  if (!environmentConfigs[envName]) {
    throw new Error(`Unknown environment: ${environment}`);
  }
  
  return environmentConfigs[envName];
}
