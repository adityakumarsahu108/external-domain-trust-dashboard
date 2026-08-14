/**
 * DataScope Cloudflare Worker + D1
 *
 * Endpoints:
 * GET  /api/health
 * GET  /api/datasets
 * GET  /api/datasets/:id
 * POST /api/datasets/import  (multipart/form-data, file=<CSV/XLSX>)
 * POST /api/datasets/:id/current
 * DELETE /api/datasets/:id
 *
 * Excel parsing is intentionally delegated to the browser/Worker-compatible
 * XLSX parser in production. Set XLSX_PARSER_URL to a vendored bundle or
 * replace parseSpreadsheet() with your preferred Worker-safe parser.
 *
 * The generic data model stores each dataset row as JSON in D1, while
 * dataset_columns stores schema/type metadata. This keeps arbitrary CSV
 * structures supported without adding a new SQL column for every export.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (request.method === "GET" && path === "/api/health") {
        return json({ ok: true, service: "datascope", storage: "cloudflare-d1" });
      }

      if (request.method === "GET" && path === "/api/datasets") {
        const result = await env.DB.prepare(`
          SELECT id, name, filename, row_count, column_count, is_current, created_at
          FROM datasets ORDER BY created_at DESC
        `).all();
        return json({ datasets: result.results });
      }

      const m = path.match(/^\/api\/datasets\/([^/]+)$/);
      if (request.method === "GET" && m) {
        const id = m[1];
        const ds = await env.DB.prepare(`SELECT * FROM datasets WHERE id=?`).bind(id).first();
        if (!ds) return json({ error: "Dataset not found" }, 404);
        const cols = await env.DB.prepare(`SELECT * FROM dataset_columns WHERE dataset_id=? ORDER BY position`).bind(id).all();
        return json({ dataset: ds, columns: cols.results });
      }

      if (request.method === "POST" && path === "/api/datasets/import") {
        const form = await request.formData();
        const file = form.get("file");
        if (!(file instanceof File)) return json({ error: "file is required" }, 400);

        const bytes = new Uint8Array(await file.arrayBuffer());
        const text = file.name.toLowerCase().endsWith(".csv") ? new TextDecoder().decode(bytes) : null;
        if (text === null) {
          return json({
            error: "Excel upload endpoint is present, but XLSX parsing must be enabled in the Worker build.",
            hint: "Use a vendored Worker-compatible XLSX parser or convert the workbook to CSV before import."
          }, 501);
        }

        const parsed = parseCSV(text);
        if (parsed.headers.length === 0) return json({ error: "No CSV header detected" }, 400);

        const id = crypto.randomUUID();
        const now = new Date().toISOString();

        await env.DB.batch([
          env.DB.prepare(`UPDATE datasets SET is_current=0 WHERE is_current=1`),
          env.DB.prepare(`INSERT INTO datasets(id,name,filename,row_count,column_count,is_current,created_at)
                          VALUES(?,?,?,?,?,?,?)`)
            .bind(id, file.name.replace(/\.[^.]+$/, ""), file.name, parsed.rows.length, parsed.headers.length, 1, now)
        ]);

        const stmts = [];
        parsed.headers.forEach((name, position) => {
          stmts.push(env.DB.prepare(`INSERT INTO dataset_columns(dataset_id,name,position,data_type)
                                     VALUES(?,?,?,?)`).bind(id, name, position, inferType(parsed.rows, position)));
        });
        for (const row of parsed.rows) {
          stmts.push(env.DB.prepare(`INSERT INTO dataset_rows(id,dataset_id,row_json) VALUES(?,?,?)`)
            .bind(crypto.randomUUID(), id, JSON.stringify(row)));
        }

        // D1 batch supports bounded batches; keep each call comfortably below the limit.
        for (let i = 0; i < stmts.length; i += 80) await env.DB.batch(stmts.slice(i, i + 80));

        return json({ ok: true, dataset: { id, name: file.name, rows: parsed.rows.length, columns: parsed.headers.length } }, 201);
      }

      if (request.method === "POST" && m && path.endsWith("/current")) {
        const id = m[1];
        const exists = await env.DB.prepare(`SELECT id FROM datasets WHERE id=?`).bind(id).first();
        if (!exists) return json({ error: "Dataset not found" }, 404);
        await env.DB.batch([
          env.DB.prepare(`UPDATE datasets SET is_current=0 WHERE is_current=1`),
          env.DB.prepare(`UPDATE datasets SET is_current=1 WHERE id=?`).bind(id)
        ]);
        return json({ ok: true, current: id });
      }

      if (request.method === "DELETE" && m) {
        const id = m[1];
        await env.DB.batch([
          env.DB.prepare(`DELETE FROM dataset_rows WHERE dataset_id=?`).bind(id),
          env.DB.prepare(`DELETE FROM dataset_columns WHERE dataset_id=?`).bind(id),
          env.DB.prepare(`DELETE FROM datasets WHERE id=?`).bind(id)
        ]);
        return json({ ok: true });
      }

      // Static assets from the Pages/Worker assets binding.
      if (env.ASSETS) return env.ASSETS.fetch(request);
      return new Response("Not found", { status: 404 });
    } catch (err) {
      return json({ error: err.message || String(err) }, 500);
    }
  }
};

function json(data, status=200) {
  return new Response(JSON.stringify(data), {
    status, headers: { "content-type": "application/json; charset=utf-8" }
  });
}

function parseCSV(text) {
  const d = detectDelimiter(text);
  const out=[], row=[]; let r=[], c="", quoted=false;
  for (let i=0;i<text.length;i++) {
    const ch=text[i], nx=text[i+1];
    if (quoted) {
      if (ch === '"' && nx === '"') { c += '"'; i++; }
      else if (ch === '"') quoted=false;
      else c += ch;
    } else if (ch === '"') quoted=true;
    else if (ch === d) { r.push(c); c=""; }
    else if (ch === "\n") { r.push(c); out.push(r); r=[]; c=""; }
    else if (ch !== "\r") c += ch;
  }
  if (c || r.length) { r.push(c); out.push(r); }
  const clean=out.filter(x=>x.some(v=>String(v??"").trim()!==""));
  const headers=(clean.shift()||[]).map((x,i)=>String(x||`Column ${i+1}`).trim());
  return {headers, rows:clean.map(x=>headers.map((_,i)=>x[i]??""))};
}
function detectDelimiter(text) {
  const line=(text.split(/\r?\n/).find(x=>x.trim())||"");
  return [",",";","\t","|"].sort((a,b)=>(line.split(b).length-1)-(line.split(a).length-1))[0];
}
function inferType(rows, i) {
  const vals=rows.map(r=>String(r[i]??"").trim()).filter(Boolean);
  if (!vals.length) return "text";
  const nums=vals.filter(v=>Number.isFinite(Number(v.replace(/,/g,"")))).length;
  const dates=vals.filter(v=>!Number.isNaN(Date.parse(v))).length;
  const unique=new Set(vals).size;
  if (nums/vals.length > .9) return "number";
  if (dates/vals.length > .85 && !/(id|code|phone)/i.test(String(i))) return "date";
  if (unique <= Math.min(50, Math.max(8, vals.length*.25))) return "category";
  return "text";
}
