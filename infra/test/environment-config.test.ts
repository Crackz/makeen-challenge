import '@jest/globals';
import { describe, test, expect } from '@jest/globals';
import { getEnvironmentConfig, EnvironmentName } from '../src/config/environment-config';
import * as cdk from 'aws-cdk-lib';

describe('Environment Configuration Tests', () => {
  describe('Development Environment', () => {
    const devConfig = getEnvironmentConfig('dev');

    test('Development environment has appropriate security settings', () => {
      // Termination protection should be disabled in dev
      expect(devConfig.terminationProtection).toBe(false);
      
      // Dev should have DESTROY removal policy for easier cleanup
      expect(devConfig.databaseSettings.removalPolicy).toBe(cdk.RemovalPolicy.DESTROY);
      
      // Point-in-time recovery can be disabled in dev
      expect(devConfig.databaseSettings.pointInTimeRecovery).toBe(false);
      
      // API key should be at least 20 characters long
      expect(devConfig.apiSettings.apiKeyValue?.length).toBeGreaterThanOrEqual(20);
      
      // Dev should have reasonable throttling limits
      expect(devConfig.apiSettings.throttleRateLimit).toBeGreaterThan(0);
      expect(devConfig.apiSettings.throttleBurstLimit).toBeGreaterThan(0);
    });
  });

  describe('Staging Environment', () => {
    const stagingConfig = getEnvironmentConfig('staging');

    test('Staging environment has appropriate security settings', () => {
      // Termination protection can be disabled in staging
      expect(stagingConfig.terminationProtection).toBe(false);
      
      // Staging should have SNAPSHOT removal policy for data protection
      expect(stagingConfig.databaseSettings.removalPolicy).toBe(cdk.RemovalPolicy.SNAPSHOT);
      
      // Point-in-time recovery should be enabled in staging
      expect(stagingConfig.databaseSettings.pointInTimeRecovery).toBe(true);
      
      // API key should not be hardcoded in staging
      expect(stagingConfig.apiSettings.apiKeyValue).toBeUndefined();
      
      // Staging should have stricter throttling limits than dev
      expect(stagingConfig.apiSettings.throttleRateLimit).toBeLessThan(
        getEnvironmentConfig('dev').apiSettings.throttleRateLimit
      );
    });
  });

  describe('Production Environment', () => {
    const prodConfig = getEnvironmentConfig('prod');

    test('Production environment has appropriate security settings', () => {
      // Termination protection must be enabled in production
      expect(prodConfig.terminationProtection).toBe(true);
      
      // Production should have RETAIN removal policy for data protection
      expect(prodConfig.databaseSettings.removalPolicy).toBe(cdk.RemovalPolicy.RETAIN);
      
      // Point-in-time recovery must be enabled in production
      expect(prodConfig.databaseSettings.pointInTimeRecovery).toBe(true);
      
      // API key should not be hardcoded in production
      expect(prodConfig.apiSettings.apiKeyValue).toBeUndefined();
      
      // Production should have stricter throttling limits than staging
      expect(prodConfig.apiSettings.throttleRateLimit).toBeLessThan(
        getEnvironmentConfig('staging').apiSettings.throttleRateLimit
      );
      
      // Production should have email alerts configured
      expect(prodConfig.monitoringSettings.alarmEmailSubscription).toBeDefined();
      
      // Production should have stricter alarm thresholds
      expect(prodConfig.monitoringSettings.alarmThresholds.apiErrors).toBeLessThan(
        getEnvironmentConfig('staging').monitoringSettings.alarmThresholds.apiErrors
      );
    });
  });

  describe('Security Validation Across Environments', () => {
    test('API key values meet security requirements', () => {
      const environments: EnvironmentName[] = ['dev', 'staging', 'prod'];
      
      environments.forEach(env => {
        const config = getEnvironmentConfig(env);
        
        // If API key is provided, it must be at least 20 characters
        if (config.apiSettings.apiKeyValue) {
          expect(config.apiSettings.apiKeyValue.length).toBeGreaterThanOrEqual(20);
        }
      });
    });

    test('Lambda settings are appropriate for each environment', () => {
      const environments: EnvironmentName[] = ['dev', 'staging', 'prod'];
      
      environments.forEach(env => {
        const config = getEnvironmentConfig(env);
        
        // Lambda timeout should be reasonable (not too long)
        expect(config.lambdaSettings.timeout.toSeconds()).toBeLessThanOrEqual(300);
        
        // Lambda should have retry attempts configured
        expect(config.lambdaSettings.retryAttempts).toBeGreaterThan(0);
        
        // Log retention should be appropriate for the environment
        if (env === 'prod') {
          expect(config.lambdaSettings.logRetentionDays).toBeGreaterThanOrEqual(30);
        }
      });
    });
  });
});
