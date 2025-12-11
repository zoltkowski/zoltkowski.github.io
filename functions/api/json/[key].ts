export const onRequestGet = async (ctx: any) => {
  const key = ctx.params.key;
  const accountId = ctx.env.CF_ACCOUNT_ID;
  const namespaceId = ctx.env.CF_KV_NAMESPACE_ID;
  const apiToken = ctx.env.CF_API_TOKEN;

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`;

  const res = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${apiToken}`
    }
  });

  if (!res.ok) {
    return new Response(`KV GET error: ${res.status}`, { status: res.status });
  }

  const value = await res.text();
  return new Response(value, {
    headers: { "Content-Type": "application/json" }
  });
};

export const onRequestPut = async (ctx: any) => {
  const key = ctx.params.key;
  const accountId = ctx.env.CF_ACCOUNT_ID;
  const namespaceId = ctx.env.CF_KV_NAMESPACE_ID;
  const apiToken = ctx.env.CF_API_TOKEN;

  const putUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`;

  const body = await ctx.request.text();

  const putResponse = await fetch(putUrl, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${apiToken}`,
      "Content-Type": "application/json"
    },
    body
  });

  if (!putResponse.ok) {
    return new Response(`KV PUT error: ${putResponse.status}`, { status: putResponse.status });
  }

  return new Response("OK");
};

export const onRequestDelete = async (ctx: any) => {
  const key = ctx.params.key;
  const accountId = ctx.env.CF_ACCOUNT_ID;
  const namespaceId = ctx.env.CF_KV_NAMESPACE_ID;
  const apiToken = ctx.env.CF_API_TOKEN;

  const deleteUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`;

  const deleteResponse = await fetch(deleteUrl, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${apiToken}`
    }
  });

  if (!deleteResponse.ok) {
    return new Response(`KV DELETE error: ${deleteResponse.status}`, { status: deleteResponse.status });
  }

  return new Response("Deleted");
};
