# Register sample app for demo
docker-compose exec main-hydra \
    hydra clients create \
    --endpoint http://main-hydra:4445 \
    --id ad97fde9-87d5-4f98-b20e-0cef75d39569 \
    --grant-types authorization_code \
    --response-types code,id_token \
    --scope openid,offline,email \
    --callbacks about:invalid \
    --token-endpoint-auth-method none


docker-compose exec sub-hydra \
    hydra clients create \
    --endpoint http://sub-hydra:4445 \
    --id e2f5401c-847a-4f34-bbc7-988ff69c723f \
    --secret 315ba4e7-971e-4806-8a2e-d4849e42d63d \
    --grant-types authorization_code,refresh_token \
    --response-types code,id_token \
    --scope openid,offline,email \
    --callbacks http://localhost:8855/callback

docker-compose exec sub-hydra \
    hydra clients create \
    --endpoint http://sub-hydra:4445 \
    --id 4288e19b-c1b3-4a56-86a4-8d350a1bcd7b \
    --grant-types authorization_code,refresh_token \
    --response-types code,id_token \
    --scope openid,offline,email \
    --callbacks 'http://localhost:3334/' \
    --post-logout-callbacks 'http://localhost:3334/' \
    --token-endpoint-auth-method none

docker-compose exec sub-hydra \
    hydra token user \
    --client-id e2f5401c-847a-4f34-bbc7-988ff69c723f \
    --client-secret 315ba4e7-971e-4806-8a2e-d4849e42d63d \
    --endpoint http://sub-hydra:4444/ \
    --auth-url http://localhost:8844/oauth2/auth \
    --redirect http://localhost:8855/callback \
    --port 5555 \
    --scope openid,offline



