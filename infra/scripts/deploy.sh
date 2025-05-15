#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status

echo 'Bootstrapping CDK environment...'
cd /infra

# Run bootstrap with error handling
if ! cdklocal bootstrap; then
    echo 'CDK bootstrap failed'
    exit 1
fi

echo 'Deploying CDK stacks...'
if ! cdklocal deploy --all --require-approval never; then
    echo 'CDK deployment failed'
    exit 1
fi

# Mark deployment as successful
echo 'CDK deployment completed successfully'
echo 'Deployment complete.'

# Script will now exit after this line
