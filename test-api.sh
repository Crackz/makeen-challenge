#!/bin/bash

set -e

# Default values
API_ENDPOINT=${API_ENDPOINT:-"http://makeen-challenge-api.execute-api.localhost.localstack.cloud:4566"}
API_KEY=${API_KEY:-"super-secret-dummy-api-key"}
ENV=${ENV:-"local"} # Use "dev", "staging", or "prod" for deployed environments

# Parse command line arguments
while [[ "$#" -gt 0 ]]; do
  case $1 in
  --env)
    ENV="$2"
    shift
    ;;
  --api-key)
    API_KEY="$2"
    shift
    ;;
  --file)
    TEST_FILE="$2"
    shift
    ;;
  --endpoint)
    API_ENDPOINT="$2"
    shift
    ;;
  *)
    echo "Unknown parameter: $1"
    exit 1
    ;;
  esac
  shift
done

# Determine the API endpoint based on environment
if [[ "$ENV" != "local" ]]; then
  # For non-local environments, try to get the endpoint from CDK outputs
  if command -v aws &>/dev/null; then
    echo "Using AWS environment: $ENV"
    API_ENDPOINT=$(aws cloudformation describe-stacks --stack-name "MakeenChallenge-${ENV}-Api" --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" --output text 2>/dev/null || echo "")
    if [[ -z "$API_ENDPOINT" ]]; then
      echo "Could not determine API endpoint from CloudFormation. Please provide --endpoint parameter."
      exit 1
    fi
  else
    echo "AWS CLI not found. Please provide --endpoint parameter."
    exit 1
  fi
fi

# Fixtures directory
FIXTURES_DIR="$(dirname "$0")/apps/text-file-processor/test/fixtures/text-files"

# Set default test file if not specified
if [[ -z "$TEST_FILE" ]]; then
  TEST_FILE="$FIXTURES_DIR/test-file.txt"
else
  # If a relative path was provided, look in the fixtures directory
  if [[ ! "$TEST_FILE" =~ ^/ ]]; then
    TEST_FILE="$FIXTURES_DIR/$TEST_FILE"
  fi
fi

# Check if the test file exists
if [[ ! -f "$TEST_FILE" ]]; then
  echo "Test file not found: $TEST_FILE"
  echo "Available test files:"
  ls -la "$FIXTURES_DIR"
  exit 1
fi

# Display test configuration
echo "Test configuration:"
echo "  API Endpoint: $API_ENDPOINT"
echo "  Test File: $TEST_FILE"
echo "  Environment: $ENV"
echo ""

# Function to test the API
test_api() {
  local file="$1"
  local filename=$(basename "$file")

  echo "Testing file: $filename"

  # Send the request
  response=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "x-api-key: $API_KEY" \
    -F "file=@$file" \
    "${API_ENDPOINT}/text-files")

  # Extract the status code and response body
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')

  # Display the results
  if [[ "$http_code" == "204" ]]; then
    echo "✓ Success (HTTP $http_code)"
    return 0
  else
    echo "✗ Failed (HTTP $http_code): $body"
    return 1
  fi
}

# Run the test with the specified file
test_api "$TEST_FILE"

# Exit with the last test's status
exit $?
