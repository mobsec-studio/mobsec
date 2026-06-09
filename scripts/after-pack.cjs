const { existsSync } = require("fs");
const path = require("path");

function cleanObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null && entry !== ""),
  );
}

async function resolveIconPath(context) {
  try {
    if (typeof context.packager.getIconPath === "function") {
      const iconPath = await context.packager.getIconPath();
      if (iconPath && existsSync(iconPath)) {
        return iconPath;
      }
    }
  } catch {
    // Fall through to the generated icon location used by electron-builder.
  }

  const candidates = [
    path.join(context.outDir, ".icon-ico", "icon.ico"),
    path.join(context.packager.projectDir, "build", "icon.ico"),
  ];
  return candidates.find((candidate) => existsSync(candidate));
}

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== "win32") {
    return;
  }

  const { rcedit } = await import("rcedit");
  const appInfo = context.packager.appInfo;
  const exeName = `${appInfo.productFilename}.exe`;
  const exePath = path.join(context.appOutDir, exeName);

  if (!existsSync(exePath)) {
    console.warn(`[afterPack] Windows executable not found: ${exePath}`);
    return;
  }

  const iconPath = await resolveIconPath(context);
  if (!iconPath) {
    console.warn("[afterPack] Windows icon patch skipped: no .ico file found.");
    return;
  }

  const fileVersion = appInfo.shortVersion || appInfo.buildVersion || appInfo.version;
  const productVersion =
    appInfo.shortVersionWindows ||
    (typeof appInfo.getVersionInWeirdWindowsForm === "function"
      ? appInfo.getVersionInWeirdWindowsForm()
      : fileVersion);

  await rcedit(exePath, {
    icon: iconPath,
    "file-version": fileVersion,
    "product-version": productVersion,
    "version-string": cleanObject({
      FileDescription: appInfo.description || appInfo.productName,
      ProductName: appInfo.productName,
      LegalCopyright: appInfo.copyright,
      CompanyName: appInfo.companyName || appInfo.productName,
      InternalName: path.basename(exeName, ".exe"),
    }),
  });

  console.log(`[afterPack] Patched Windows executable icon: ${exePath}`);
};
