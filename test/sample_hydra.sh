# Register sample app for demo
##     --id ad97fde9-87d5-4f98-b20e-0cef75d39569 \
docker-compose exec main-hydra \
    hydra create oauth2-client \
    --endpoint "http://main-hydra:4445" \
    --grant-type "authorization_code" \
    --response-type "code,id_token" \
    --scope "openid,offline,email" \
    --redirect-uri "about:invalid" \
    --token-endpoint-auth-method "none"

##     --id e2f5401c-847a-4f34-bbc7-988ff69c723f \
subhydra_client="$(docker-compose exec sub-hydra \
    hydra create oauth2-client \
    --endpoint "http://sub-hydra:4445" \
    --secret "315ba4e7-971e-4806-8a2e-d4849e42d63d" \
    --grant-type "authorization_code,refresh_token" \
    --response-type "code,id_token" \
    --scope "openid,offline,email" \
    --redirect-uri "http://localhost:8855/callback" \
    --format "json"
)"
subhydra_client_id="$(echo $client | jq -r '.client_id')"

docker-compose exec sub-hydra \
    hydra perform authorization-code \
    --client-id "$subhydra_client_id" \
    --client-secret "315ba4e7-971e-4806-8a2e-d4849e42d63d" \
    --endpoint "http://sub-hydra:4444/" \
    --auth-url "http://localhost:8844/oauth2/auth" \
    --redirect "http://localhost:8855/callback" \
    --port "5555" \
    --scope "openid,offline" \
    --no-open
