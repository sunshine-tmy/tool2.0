/** Windows bootstrap is the authority for its tools, including before Node exists. */
export function readBootstrapArchives(source) {
  const value = (name, pattern) => {
    const matches = [...source.matchAll(new RegExp(`^\\$${name} = '([^']+)'$`, "gm"))];
    if (matches.length !== 1 || !pattern.test(matches[0][1])) throw new Error(`Invalid bootstrap pin: ${name}`);
    return matches[0][1];
  };
  const node = value("NodeVersion", /^\d+\.\d+\.\d+$/);
  const pnpm = value("PnpmVersion", /^\d+\.\d+\.\d+$/);
  return [
    {
      filename: `node-v${node}-win-x64.zip`,
      url: `https://nodejs.org/dist/v${node}/node-v${node}-win-x64.zip`,
      algorithm: "SHA256",
      digest: value("NodeHash", /^[a-f0-9]{64}$/)
    },
    {
      filename: `pnpm-${pnpm}.tgz`,
      url: `https://registry.npmjs.org/pnpm/-/pnpm-${pnpm}.tgz`,
      algorithm: "SHA512",
      digest: value("PnpmHash", /^[A-Za-z0-9+/]{86}==$/)
    }
  ];
}
