const path = require("node:path");

module.exports = {
  packagerConfig: {
    asar: true,
    extraResource: [
      path.resolve(__dirname, "../../backend/dist"),
      path.resolve(__dirname, "../../frontend/dist"),
      path.resolve(__dirname, "../../scripts")
    ],
    ignore: [/(^|[\\/])(src|out|test-results)([\\/]|$)/]
  },
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      config: {
        name: "ecommerce_toolbox",
        setupExe: "EcommerceToolboxSetup.exe"
      }
    }
  ],
  plugins: [
    {
      name: "@electron-forge/plugin-auto-unpack-natives",
      config: {}
    }
  ]
};
