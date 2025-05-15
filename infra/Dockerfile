FROM node:22-slim

# install dependencies
RUN apt-get update && apt-get install -y curl unzip && rm -rf /var/lib/apt/lists/*

# install cdk local
RUN npm install -g aws-cdk-local aws-cdk

# install aws cli
# TODO: specify a cli version
RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
RUN unzip awscliv2.zip
RUN ./aws/install
RUN aws --version

WORKDIR /infra
COPY package.json /infra/
RUN npm install 

CMD [ "/bin/bash", "scripts/deploy.sh" ]