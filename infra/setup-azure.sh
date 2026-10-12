#!/usr/bin/env bash
# One-time Azure setup for the blue-green pipeline.
# Creates: resource group, Linux App Service plan (S1 - slots need Standard or higher),
# a Web App for Containers with a "staging" slot, and an Entra app with OIDC
# federated credentials so GitHub Actions can log in without stored passwords.
#
# Usage: ./infra/setup-azure.sh <github-owner/repo> [location]
set -euo pipefail

REPO="${1:?usage: $0 <github-owner/repo> [location]}"
LOCATION="${2:-centralindia}"
RG="rg-todo-service"
PLAN="plan-todo-service"
APP="todo-service-$RANDOM"
IMAGE="nginx:alpine"   # placeholder until the first pipeline run

echo "Creating resource group $RG in $LOCATION"
az group create -n "$RG" -l "$LOCATION" -o none

echo "Creating App Service plan $PLAN (S1)"
az appservice plan create -g "$RG" -n "$PLAN" --is-linux --sku S1 -o none

echo "Creating web app $APP"
az webapp create -g "$RG" -p "$PLAN" -n "$APP" --deployment-container-image-name "$IMAGE" -o none
az webapp config appsettings set -g "$RG" -n "$APP" --settings WEBSITES_PORT=8080 SLOT_NAME=production -o none

echo "Creating staging slot"
az webapp deployment slot create -g "$RG" -n "$APP" --slot staging --configuration-source "$APP" -o none
# Sticky setting: SLOT_NAME stays with the slot, so /version always shows which colour is live.
az webapp config appsettings set -g "$RG" -n "$APP" --slot staging --slot-settings SLOT_NAME=staging -o none
az webapp config appsettings set -g "$RG" -n "$APP" --slot-settings SLOT_NAME=production -o none
az webapp config set -g "$RG" -n "$APP" --generic-configurations '{"healthCheckPath": "/health"}' -o none

echo "Creating Entra app + OIDC federated credentials for $REPO"
SUB_ID=$(az account show --query id -o tsv)
TENANT_ID=$(az account show --query tenantId -o tsv)
APP_ID=$(az ad app create --display-name "gh-$APP" --query appId -o tsv)
az ad sp create --id "$APP_ID" -o none
az role assignment create --assignee "$APP_ID" --role Contributor \
  --scope "/subscriptions/$SUB_ID/resourceGroups/$RG" -o none

for ENV in staging production; do
  az ad app federated-credential create --id "$APP_ID" --parameters "{
    \"name\": \"gh-$ENV\",
    \"issuer\": \"https://token.actions.githubusercontent.com\",
    \"subject\": \"repo:$REPO:environment:$ENV\",
    \"audiences\": [\"api://AzureADTokenExchange\"]
  }" -o none
done

cat <<EOF

Done. Add these to GitHub (Settings -> Secrets and variables -> Actions):

  Secrets:
    AZURE_CLIENT_ID       = $APP_ID
    AZURE_TENANT_ID       = $TENANT_ID
    AZURE_SUBSCRIPTION_ID = $SUB_ID
    DOCKERHUB_TOKEN       = <Docker Hub access token>

  Variables:
    AZURE_WEBAPP_NAME     = $APP
    AZURE_RESOURCE_GROUP  = $RG
    DOCKERHUB_USERNAME    = <your Docker Hub username>

Also create GitHub environments named "staging" and "production".
Tear down later with: az group delete -n $RG
EOF
