import { APIGatewayAuthorizerResult } from 'aws-lambda';

// Custom interface for HTTP API authorizer event
interface HttpApiAuthorizerEvent {
  headers?: Record<string, string>;
  routeArn: string;
  methodArn?: string;
}

/**
 * Lambda authorizer for validating API keys in HTTP API (API Gateway v2)
 */
export const handler = async (
  event: HttpApiAuthorizerEvent
): Promise<APIGatewayAuthorizerResult> => {
  console.log('API Key Authorizer invoked');
  
  // Get the API key from the request headers
  const apiKey = event.headers?.['x-api-key'] || event.headers?.['X-Api-Key'];
  
  // Get the expected API key from environment variables
  const expectedApiKey = process.env.API_KEY;
  
  // Check if API key is provided and matches the expected value
  const isAuthorized = !!apiKey && !!expectedApiKey && apiKey === expectedApiKey;
  
  console.log(`Authorization ${isAuthorized ? 'successful' : 'failed'}`);
  
  // Return the authorization result
  return {
    principalId: isAuthorized ? 'user' : 'unauthorized',
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: isAuthorized ? 'Allow' : 'Deny',
          Resource: event.routeArn || event.methodArn || '*',
        },
      ],
    },
    // Optional context that can be accessed in the Lambda function
    context: {
      authenticated: isAuthorized,
    },
  };
};
