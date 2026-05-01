function compilePath(path) {
  const names = [];
  const pattern = path
    .split("/")
    .map((part) => {
      if (!part.startsWith(":")) return part;
      names.push(part.slice(1));
      return "([^/]+)";
    })
    .join("/");
  return {
    regex: new RegExp(`^${pattern}$`),
    names
  };
}

function createRouter() {
  const routes = [];

  function add(method, path, handler) {
    const compiled = compilePath(path);
    routes.push({ method, path, handler, ...compiled });
  }

  function match(method, pathname) {
    for (const route of routes) {
      if (route.method !== method) continue;
      const found = pathname.match(route.regex);
      if (!found) continue;
      const params = {};
      route.names.forEach((name, index) => {
        params[name] = decodeURIComponent(found[index + 1]);
      });
      return { handler: route.handler, params };
    }
    return null;
  }

  return { add, match };
}

module.exports = createRouter;
