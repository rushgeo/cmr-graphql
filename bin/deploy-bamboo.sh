#!/bin/bash

# Bail on unset variables, errors and trace execution
set -eux

# Set up Docker image
#####################

cat <<EOF > .dockerignore
node_modules
.serverless
EOF

cat <<EOF > Dockerfile
FROM node:18.16-bullseye
COPY . /build
WORKDIR /build
RUN npm ci --omit=dev
RUN apt-get update
RUN apt-get install -y python3 python3-pip python-is-python3
RUN pip install -r requirements.txt
EOF

dockerTag=edsc-$bamboo_STAGE_NAME
docker build -t $dockerTag .

# Convenience function to invoke `docker run` with appropriate env vars instead of baking them into image
dockerRun() {
    docker run \
        -e "AWS_ACCESS_KEY_ID=$bamboo_AWS_ACCESS_KEY_ID" \
        -e "AWS_SECRET_ACCESS_KEY=$bamboo_AWS_SECRET_ACCESS_KEY" \
        -e "CLOUDFRONT_BUCKET_NAME=$bamboo_CLOUDFRONT_BUCKET_NAME" \
        -e "CMR_ROOT_URL=$bamboo_CMR_ROOT_URL" \
        -e "DRAFT_MMT_ROOT_URL=$bamboo_DRAFT_MMT_ROOT_URL" \
        -e "EDL_JWK=$bamboo_EDL_JWK" \
        -e "EDL_KEY_ID=$bamboo_EDL_KEY_ID" \
        -e "GRAPHDB_HOST=$bamboo_GRAPHDB_HOST" \
        -e "GRAPHDB_PATH=$bamboo_GRAPHDB_PATH" \
        -e "GRAPHDB_PORT=$bamboo_GRAPHDB_PORT" \
        -e "LAMBDA_TIMEOUT=$bamboo_LAMBDA_TIMEOUT" \
        -e "LOG_DESTINATION_ARN=$bamboo_LOG_DESTINATION_ARN" \
        -e "MMT_ROOT_URL=$bamboo_MMT_ROOT_URL" \
        -e "NODE_ENV=production" \
        -e "DMMT_SSL_CERT=$bamboo_DMMT_SSL_CERT" \
        -e "SUBNET_ID_A=$bamboo_SUBNET_ID_A" \
        -e "SUBNET_ID_B=$bamboo_SUBNET_ID_B" \
        -e "VPC_ID=$bamboo_VPC_ID" \
        $dockerTag "$@"
}

# Execute serverless commands in Docker
#######################################

stageOpts="--stage $bamboo_STAGE_NAME"

# Deploy AWS Infrastructure Resources
echo 'Deploying AWS Infrastructure Resources...'
dockerRun npx serverless deploy $stageOpts --config serverless-infrastructure.yml

# Deploy AWS Application Resources
echo 'Deploying AWS Application Resources...'
dockerRun npx serverless deploy $stageOpts
