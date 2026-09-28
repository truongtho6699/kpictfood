const APPS_SCRIPT='https://script.google.com/macros/s/AKfycbyLUhP_k2S9bKRucE40_49qMXEVPPshB5ZgyVaIgEztTFkt8Oq869m0mQxrEqFijFKn/exec';
export default {
  async fetch(request, env) {
    const url=new URL(request.url);
    if(url.pathname==='/api'||url.pathname.startsWith('/api/')){
      const target=new URL(APPS_SCRIPT);
      target.search=url.search;
      const init={method:request.method,headers:{'Content-Type':request.headers.get('Content-Type')||'text/plain;charset=utf-8'},redirect:'follow'};
      if(!['GET','HEAD'].includes(request.method)) init.body=await request.arrayBuffer();
      try{
        const upstream=await fetch(target.toString(),init);
        const body=await upstream.arrayBuffer();
        return new Response(body,{status:upstream.status,headers:{'Content-Type':upstream.headers.get('Content-Type')||'application/json;charset=utf-8','Cache-Control':'no-store'}});
      }catch(e){
        return Response.json({ok:false,error:'API_PROXY_ERROR'},{status:502});
      }
    }
    if(url.pathname==='/health') return Response.json({ok:true,service:'kpictfood',proxy:'/api',revision:'public-appscript-v1'}); return env.ASSETS.fetch(request);
  }
};