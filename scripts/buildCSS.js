const fs = require('fs');
const path = require("path");
const documentStyles = fs.readFileSync(path.resolve(__dirname, "prebuild/ds-browser.css"));
const moduleWrapper = `const DSBrowserStyles = \`${documentStyles}\`;
module.exports = DSBrowserStyles;
`;
fs.writeFileSync(path.resolve(__dirname,'./../src/styles/DSBrowserStyles.js'), moduleWrapper, "utf8");