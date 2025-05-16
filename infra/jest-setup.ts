import path from "path";
import { jest } from '@jest/globals';

// Set ROOT_FOLDER_PATH to the project root.
// __dirname in jest-setup.ts is /home/maz/SideProjects/challenges/makeen-challenge/infra
const projectRootForTests = path.resolve(__dirname, ".."); // -> /home/maz/SideProjects/challenges/makeen-challenge
process.env.ROOT_FOLDER_PATH = projectRootForTests;

// Mock CDK asset and S3 operations to avoid filesystem/AWS calls during tests

jest.mock('aws-cdk-lib/aws-lambda', () => {
  const originalLambda = jest.requireActual('aws-cdk-lib/aws-lambda');
  return {
    ...(originalLambda as any), // Use 'as any' to allow spread on module
    Code: {
      ...(originalLambda as any).Code,
      fromAsset: jest.fn().mockImplementation((assetPath: any) => ({ // Use any for param, concise return
        isInline: false,
        bind: jest.fn().mockReturnValue({
          s3Location: { bucketName: 'mocked-asset-bucket', objectKey: `mocked-asset-key-for-${path.basename(assetPath)}` },
        }),
        bindToResource: jest.fn(), // For completeness if used by CDK
      })),
      fromBucket: jest.fn().mockImplementation((bucket: any, key: any) => ({ // Use any for params, concise return
        isInline: false,
        bind: jest.fn().mockReturnValue({
          s3Location: { bucketName: bucket.bucketName, objectKey: key },
        }),
        bindToResource: jest.fn(),
      })),
    },
  };
});

jest.mock('aws-cdk-lib/aws-s3', () => {
  const originalS3 = jest.requireActual('aws-cdk-lib/aws-s3');
  return {
    ...(originalS3 as any), // Use 'as any' to allow spread on module
    Bucket: {
      ...(originalS3 as any).Bucket,
      fromBucketName: jest.fn().mockImplementation((scope: any, id: any, bucketName: any) => ({ // Use any for params, concise return
        bucketName,
        bucketArn: `arn:aws:s3:::${bucketName}`,
        // Mock any methods on Bucket that might be called from your stacks
        grantRead: jest.fn(),
        // Add other grant methods if your LambdaStack, for example, calls them on the hot-reload bucket
      })),
    },
  };
});

// Optional: If you still encounter issues with fs.existsSync for specific paths related to assets:
// import fs from 'fs';
// const actualFs = jest.requireActual('fs');
// jest.spyOn(fs, 'existsSync').mockImplementation((p: fs.PathLike) => {
//   if (typeof p === 'string' && p.startsWith(projectRootForTests) && p.includes('apps/text-file-processor/dist')) {
//     // console.log(`Mocked fs.existsSync for ${p} to return true`);
//     return true; // Mock existence of expected asset paths
//   }
//   return actualFs.existsSync(p);
// });
