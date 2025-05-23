# Makeen Challenge

## Table of Contents

- [Test API (tl;dr)](#test-api-tldr)
- [Architecture](#architecture)
- [Setup](#setup)
  - [Initial setup](#initial-setup)
  - [Run and destroy the development environment](#run-and-destroy-the-development-environment)
  - [Check the Services Logs](#check-the-services-logs)
  - [Run the tests](#run-the-tests)
- [Deployment](#deployment)
- [Misc](#misc)
  - [Scalable solution](#scalable-solution)
  - [Better e2e tests](#better-e2e-tests)
  - [Code quality](#code-quality)
  - [API Documentation](#api-documentation)

## Test API (tl;dr)

- Install taskfile `npm install -g @go-task/cli`
- Run `npm install && task run`
- Test the API:

```bash
# Test with default settings (local environment, test-file.txt)
./test-api.sh

# Test with a specific file from fixtures
./test-api.sh --file multiline-file.txt
```

## Architecture

![Architecture](https://raw.githubusercontent.com/Crackz/makeen-challenge/refs/heads/feature/text-processor-service/diagrams/architecture.png)

## Setup

#### Initial setup

- Install LTS versions of Node.js, Docker, and Docker Compose.

- Run `npm install -g @go-task/cli`

  > This will install the Task CLI globally (it's similar to [Make](https://www.computerhope.com/unix/umake.htm) on Linux).

- Run `npm install` at the root level

  > This will start installing all services dependencies.

---

#### Run and destroy the development environment

to run the development environment:

- `task dev:run`
  > this command will build and deploy the infrastructure to localstack automatically, then rebuild text file processor if any changes are detected (hot reloading).

to destroy the development environment:

- `task dev:destroy`
  > Be careful as it will delete all existing data in the localstack volume.it's super handy if you faced weird issue with localstack.

---

#### Check the Services Logs

To check localstack logs:

- `task localstack:log`

To check infra logs:

- `task infra:log`

> That's a custom container which runs CDK to deploy the infrastructure to localstack

#### Run the tests

To test text file processor:

- For unit tests:
  - `task tfp:test:run`
- For end-to-end tests:
  - `task test:e2e:run`
    > You can destroy the containers after running the tests to clean up the data using `task test:e2e:destroy`

To test infrastructure:

- `task infra:test:run`

---

#### Deployment

> Run your normal cdk commands with STAGE env var

- `STAGE=staging cdk deploy --all`
  > supported environments: dev (default,localstack), staging, prod

---

#### Misc

##### Scalable solution

###### Issue:

- The current implementation stores files in memory then process them which isn't ideal and could lead to high memory usage.

###### Solution:

1. Create a lambda function to generate a presigned url for the files.
2. Move the files processing to a lambda function that will be triggered when a new file is uploaded to S3.

###### Architecture:

![Architecture](https://raw.githubusercontent.com/Crackz/makeen-challenge/refs/heads/feature/text-processor-service/diagrams/scalable-architecture.png)

##### Better e2e tests

The current implementation spin up a single localstack instance for all tests, we could utilize [testcontainers](https://testcontainers.com/) to spin up a localstack instance for each test.

##### Code quality

- Graceful shutdown isn't handled
- You could find comments across the codebase that explain how we could improve it (they have 'TODO' prefix)

> Note: Most of the tests are created by AI, I reviewed them to make sure they covered most of the cases.

##### API Documentation

I didn't add it to save time, however you could check any of my public repos to see how I document my APIs [here](https://github.com/Crackz)
