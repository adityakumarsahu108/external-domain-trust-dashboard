export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const p = url.pathname;
    try {
      if (p === "/api/health" && request.method === "GET") return json({ok:true,service:"datascope",storage:"d1"});

      if (p === "/api/datasets" && request.method === "GET") {
        const r = await env.DB.prepare(`SELECT id,name,filename,row_count,column_count,is_current,created_at FROM datasets ORDER BY created_at DESC`).all();
        return json({datasets:r.results});
      }

      if (p === "/api/datasets/current" && request.method === "GET") {
        const d = await env.DB.prepare(`SELECT * FROM datasets WHERE is_current=1 ORDER BY created_at DESC LIMIT 1`).first();
        if (!d) return json({error:"No current dataset"},404);
        const cols = await env.DB.prepare(`SELECT name,position,data_type FROM dataset_columns WHERE dataset_id=? ORDER BY position`).bind(d.id).all();
        const rows = await env.DB.prepare(`SELECT row_json FROM dataset_rows WHERE dataset_id=? ORDER BY row_number`).bind(d.id).all();
        return json({dataset:d,columns:cols.results,rows:rows.results});
      }

      const rowsMatch = p.match(/^\/api\/datasets\/([^/]+)\/rows$/);
      if (rowsMatch && request.method === "POST") {
        const id=rowsMatch[1], body=await request.json();
        const exists=await env.DB.prepare(`SELECT id FROM datasets WHERE id=?`).bind(id).first();
        if(!exists) return json({error:"Dataset not found"},404);
        const rows=Array.isArray(body.rows)?body.rows:[];
        if(!rows.length) return json({ok:true,inserted:0});
        const current=await env.DB.prepare(`SELECT COALESCE(MAX(row_number),0) n FROM dataset_rows WHERE dataset_id=?`).bind(id).first();
        let n=Number(current?.n||0);
        const stmts=rows.map(row=>env.DB.prepare(`INSERT INTO dataset_rows(id,dataset_id,row_number,row_json) VALUES(?,?,?,?)`).bind(crypto.randomUUID(),id,++n,JSON.stringify(row)));
        for(let i=0;i<stmts.length;i+=80) await env.DB.batch(stmts.slice(i,i+80));
        return json({ok:true,inserted:rows.length});
      }

      const publishMatch=p.match(/^\/api\/datasets\/([^/]+)\/publish$/);
      if(publishMatch && request.method==="POST"){
        const id=publishMatch[1];
        const d=await env.DB.prepare(`SELECT id FROM datasets WHERE id=?`).bind(id).first();
        if(!d)return json({error:"Dataset not found"},404);
        await env.DB.batch([
          env.DB.prepare(`UPDATE datasets SET is_current=0 WHERE is_current=1`),
          env.DB.prepare(`UPDATE datasets SET is_current=1 WHERE id=?`).bind(id)
        ]);
        return json({ok:true,current:id});
      }

      const currentMatch=p.match(/^\/api\/datasets\/([^/]+)\/current$/);
      if(currentMatch && request.method==="POST"){
        const id=currentMatch[1];
        const d=await env.DB.prepare(`SELECT id FROM datasets WHERE id=?`).bind(id).first();
        if(!d)return json({error:"Dataset not found"},404);
        await env.DB.batch([
          env.DB.prepare(`UPDATE datasets SET is_current=0 WHERE is_current=1`),
          env.DB.prepare(`UPDATE datasets SET is_current=1 WHERE id=?`).bind(id)
        ]);
        return json({ok:true,current:id});
      }

      const importMatch=p==="/api/datasets/import";
      if(importMatch && request.method==="POST"){
        const body=await request.json();
        if(!Array.isArray(body.headers)||!Number.isInteger(body.rowCount))return json({error:"Invalid dataset metadata: headers must be an array and rowCount must be an integer"},400);
        const types=Array.isArray(body.types)?body.types:body.headers.map(h=>typeof body.types==="object"&&body.types?body.types[h]||"text":"text");
        if(body.headers.length===0)return json({error:"Dataset has no columns"},400);
        const id=crypto.randomUUID(), now=new Date().toISOString();
        const stmts=[
          env.DB.prepare(`INSERT INTO datasets(id,name,filename,row_count,column_count,is_current,created_at) VALUES(?,?,?,?,?,0,?)`)
            .bind(id,String(body.name||"Dataset"),String(body.filename||"dataset"),body.rowCount,body.headers.length,now)
        ];
        body.headers.forEach((name,i)=>stmts.push(env.DB.prepare(`INSERT INTO dataset_columns(dataset_id,name,position,data_type) VALUES(?,?,?,?)`).bind(id,String(name),i,String(types[i]||"text"))));
        await env.DB.batch(stmts);
        return json({ok:true,dataset:{id,name:body.name,rows:body.rowCount,columns:body.headers.length}},201);
      }

      if (env.ASSETS) return env.ASSETS.fetch(request);
      return new Response("Not found",{status:404});
    } catch(e) { return json({error:e?.message||String(e)},500); }
  }
};
function json(x,status=200){return new Response(JSON.stringify(x),{status,headers:{"content-type":"application/json;charset=UTF-8"}})}
