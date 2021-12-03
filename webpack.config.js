const path = require("path");
const glob = require("glob");

const entries = Object.fromEntries(
  glob.sync("./src/*.ts").map(function (key) {
    const basename = path.basename(key, ".ts");
    return [basename, key];
  })
);

module.exports = {
  mode: "production",
  entry: entries,
  output: {
    filename: "[name].js",
    path: path.resolve(__dirname, "public/js"),
  },
};
