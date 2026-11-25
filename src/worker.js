// The ticks API. Files in public/ are served before this script runs, so
// it only sees /api/ requests and paths with no file.
//
// GET    /api/ticks               200 { ticks: [{ level, test }] }
// PUT    /api/ticks/:level/:test  204, ticks that test
// DELETE /api/ticks/:level/:test  204, unticks it

// A level or test slug, as in CONTENT. Anything else gets a 404.
const SLUG_PATTERN = /^[a-z0-9-]{1,40}$/;
const TICK_PATH_PATTERN = /^\/api\/ticks\/(?<level>[^/]+)\/(?<test>[^/]+)$/;

export default {
  async fetch(request, env) {
    let response;
    try {
      response = await handleRequest(request, env);
    } catch (error) {
      console.error(JSON.stringify({ message: 'Request failed', error: String(error) }));
      response = Response.json({ error: 'Something went wrong' }, { status: 500 });
    }
    // _headers only covers static files, so responses built here set
    // these themselves. The ticks change with every write, so nothing
    // may cache them.
    response.headers.set('X-Robots-Tag', 'noindex');
    response.headers.set('Cache-Control', 'no-store');
    return response;
  },
};

async function handleRequest(request, env) {
  const { pathname } = new URL(request.url);

  if (pathname === '/api/ticks') {
    if (request.method === 'GET') return listTicks(env);
    return methodNotAllowed('GET');
  }

  const tickPath = TICK_PATH_PATTERN.exec(pathname);
  if (tickPath) {
    const { level, test } = tickPath.groups;
    if (!SLUG_PATTERN.test(level) || !SLUG_PATTERN.test(test)) return notFound();
    if (request.method === 'PUT') return addTick(env, level, test);
    if (request.method === 'DELETE') return removeTick(env, level, test);
    return methodNotAllowed('PUT, DELETE');
  }

  return notFound();
}

async function listTicks(env) {
  const { results } = await env.DB.prepare(
    'SELECT level_slug, test_slug FROM ticks ORDER BY level_slug, test_slug',
  ).all();
  const ticks = results.map((row) => ({ level: row.level_slug, test: row.test_slug }));
  return Response.json({ ticks });
}

// OR IGNORE makes a repeated PUT harmless, and keeps the first tick's time.
async function addTick(env, levelSlug, testSlug) {
  await env.DB.prepare(
    'INSERT OR IGNORE INTO ticks (level_slug, test_slug, ticked_at) VALUES (?, ?, unixepoch())',
  )
    .bind(levelSlug, testSlug)
    .run();
  return new Response(null, { status: 204 });
}

async function removeTick(env, levelSlug, testSlug) {
  await env.DB.prepare('DELETE FROM ticks WHERE level_slug = ? AND test_slug = ?')
    .bind(levelSlug, testSlug)
    .run();
  return new Response(null, { status: 204 });
}

function notFound() {
  return Response.json({ error: 'Not found' }, { status: 404 });
}

function methodNotAllowed(allowedMethods) {
  return Response.json(
    { error: 'Method not allowed' },
    { status: 405, headers: { Allow: allowedMethods } },
  );
}
