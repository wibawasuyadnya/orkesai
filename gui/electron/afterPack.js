// electron-builder afterPack hook: give the mac bundle a COHERENT deep ad-hoc
// signature. Without a paid Developer ID the app still trips Gatekeeper after
// a browser download (users clear it once with `xattr -cr`), but a valid
// bundle-wide signature keeps codesign/spctl diagnostics clean and lets the
// embedded python binaries run without per-file complaints.
const { execSync } = require("child_process");
const path = require("path");

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  execSync(`codesign --force --deep --sign - "${app}"`, { stdio: "inherit" });
};
