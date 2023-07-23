import fs from "fs-extra";

// specify the base and target directories
const baseDir = "./dist/extension-hyperlink/src";
const targetDir = "./dist/src";

// copy files from base directory to target directory
fs.copySync(baseDir, targetDir);

// remove the base directory
fs.removeSync("./dist/extension-hyperlink");
