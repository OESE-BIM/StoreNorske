/* Pakker en funksjon slik at feil kommer tilbake som lesbar JSON i stedet for en naken 500. */
module.exports = function wrap(fn) {
  return async function (context, req) {
    try {
      await fn(context, req);
    } catch (e) {
      context.log.error(e);
      context.res = {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        body: {
          error: (e && e.message) || String(e),
          kode: (e && (e.code || e.statusCode)) || null,
          hvor: (context.executionContext && context.executionContext.functionName) || null
        }
      };
    }
  };
};
