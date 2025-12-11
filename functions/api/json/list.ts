export const onRequestGet = async (ctx: any) => {
  const accountId = ctx.env.CF_ACCOUNT_ID;
  const namespaceId = ctx.env.CF_KV_NAMESPACE_ID;
  const apiToken = ctx.env.CF_API_TOKEN;

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/keys`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiToken}`
    }
  });

  if (!res.ok) {
    return new Response(`KV list error: ${res.status}`, { status: 500 });
  }

  const json = await res.json();
  return new Response(JSON.stringify(json), {
    headers: { "Content-Type": "application/json" }
  });
};
